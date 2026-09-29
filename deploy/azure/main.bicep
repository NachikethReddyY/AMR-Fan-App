targetScope = 'resourceGroup'

@description('Azure region for the staging resources. The resource group must be created in this region before deployment.')
param location string = resourceGroup().location

@description('Stable prefix used to derive names for this staging environment.')
param namePrefix string = 'amr-fan'

@description('Existing ACR name. ACR Tasks/builds are optional; this template only grants pull access.')
param registryName string = 'amrfanstaging044956'

@description('Repository in ACR containing the API image.')
param imageRepository string = 'amr-api'

@minLength(71)
@description('Immutable ACR image digest, for example sha256:<64 hexadecimal characters>. Tags are not accepted by this package.')
param imageDigest string

@description('PostgreSQL Flexible Server bootstrap administrator. Do not use this account as the API runtime identity.')
param postgresAdminLogin string = 'amr_staging_admin'

@secure()
@description('PostgreSQL Flexible Server administrator password. Supply from a private deployment parameter file.')
param postgresAdminPassword string

@description('OIDC issuer URL for the selected Entra External ID customer tenant.')
param authIssuer string

@description('OIDC audience accepted by the production API.')
param authAudience string

@description('HTTPS OIDC JWKS URL for the production API.')
param authJwksUrl string

@description('Required OIDC scope for API access tokens.')
param authRequiredScope string = 'account.access'

@description('Start at zero while the controlled migration is run. Set to 1 only after migration verification.')
param minReplicas int = 0

@description('Maximum API replicas for this staging candidate.')
param maxReplicas int = 1

@description('Keep the API resource absent until migrations and the Key Vault database secret have been verified.')
param deployApi bool = false

var suffix = uniqueString(resourceGroup().id, namePrefix)
var vnetName = '${namePrefix}-vnet-${suffix}'
var postgresName = '${namePrefix}-pg-${suffix}'
var postgresDnsName = 'privatelink.postgres.database.azure.com'
var environmentName = '${namePrefix}-env-${suffix}'
var workspaceName = '${namePrefix}-logs-${suffix}'
var vaultName = toLower(take(replace('${namePrefix}${suffix}', '-', ''), 24))
var identityName = '${namePrefix}-identity-${suffix}'
var apiName = '${namePrefix}-api-${suffix}'
var keyVaultSecretsUserRole = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '4633458b-17de-408a-b874-0445c86b69e6'
)
var acrPullRole = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '7f951dda-4ed3-4680-a7ca-43fe172d538d'
)

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: registryName
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.42.0.0/16'
      ]
    }
  }
}

resource acaSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' = {
  parent: vnet
  name: 'aca-infrastructure'
  properties: {
    addressPrefix: '10.42.0.0/23'
    delegations: [
      {
        name: 'container-apps'
        properties: {
          serviceName: 'Microsoft.App/environments'
        }
      }
    ]
  }
}

resource postgresSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' = {
  parent: vnet
  name: 'postgres'
  properties: {
    addressPrefix: '10.42.2.0/24'
    delegations: [
      {
        name: 'postgres-flexible-server'
        properties: {
          serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
        }
      }
    ]
  }
}

resource postgresDns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: postgresDnsName
  location: 'global'
}

resource postgresDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: postgresDns
  name: '${vnetName}-link'
  location: 'global'
  properties: {
    virtualNetwork: {
      id: vnet.id
    }
    registrationEnabled: false
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '17'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
      autoGrow: 'Enabled'
      type: 'Premium_LRS'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      delegatedSubnetResourceId: postgresSubnet.id
      privateDnsZoneArmResourceId: postgresDns.id
      publicNetworkAccess: 'Disabled'
    }
  }
}

resource postgresTls 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: postgres
  name: 'require_secure_transport'
  properties: {
    value: 'on'
    source: 'user-override'
  }
}

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enabledForTemplateDeployment: true
    publicNetworkAccess: 'Enabled'
    sku: {
      family: 'A'
      name: 'standard'
    }
  }
}

resource apiIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

resource vaultSecretReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, apiIdentity.id, keyVaultSecretsUserRole)
  scope: vault
  properties: {
    roleDefinitionId: keyVaultSecretsUserRole
    principalId: apiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, apiIdentity.id, acrPullRole)
  scope: acr
  properties: {
    roleDefinitionId: acrPullRole
    principalId: apiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Stored only in Key Vault. The runtime role is created and granted by the
// controlled migration operation after PostgreSQL provisioning.
resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  properties: {
    retentionInDays: 30
    features: {
      searchVersion: 1
    }
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  properties: {
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
    vnetConfiguration: {
      infrastructureSubnetId: acaSubnet.id
      internal: false
    }
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: workspace.properties.customerId
        sharedKey: workspace.listKeys().primarySharedKey
      }
    }
  }
}

resource api 'Microsoft.App/containerApps@2024-03-01' = if (deployApi) {
  name: apiName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${apiIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: acr.properties.loginServer
          identity: apiIdentity.id
        }
      ]
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'database-url'
          keyVaultUrl: '${vault.properties.vaultUri}secrets/database-url'
          identity: apiIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: '${acr.properties.loginServer}/${imageRepository}@${imageDigest}'
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'API_HOST', value: '0.0.0.0' }
            { name: 'API_PORT', value: '8080' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'AUTH_ISSUER', value: authIssuer }
            { name: 'AUTH_AUDIENCE', value: authAudience }
            { name: 'AUTH_JWKS_URL', value: authJwksUrl }
            { name: 'AUTH_REQUIRED_SCOPE', value: authRequiredScope }
            { name: 'AUTH_DEV_ENABLED', value: 'false' }
            { name: 'ACTIVITY_ASSESSMENT_ENABLED', value: 'false' }
            { name: 'AMR_ROUTES_PROVIDER', value: 'disabled' }
            { name: 'LUNA_REPORT_EXTRACTION_ENABLED', value: 'false' }
            { name: 'LAYA_ADVISORY_ENABLED', value: 'false' }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8080
              }
              initialDelaySeconds: 10
              periodSeconds: 30
              timeoutSeconds: 3
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/ready'
                port: 8080
              }
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 3
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
  dependsOn: [
    vaultSecretReader
    acrPull
    postgresTls
  ]
}

output postgresServerName string = postgres.name
output keyVaultName string = vault.name
output containerAppName string = deployApi ? apiName : ''
output containerImage string = '${acr.properties.loginServer}/${imageRepository}@${imageDigest}'
