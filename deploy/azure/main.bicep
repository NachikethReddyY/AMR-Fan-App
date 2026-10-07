targetScope = 'resourceGroup'

@description('Azure region for the Container Apps environment and PostgreSQL server.')
param location string = resourceGroup().location

@description('Stable, globally unique prefix for Azure resource names.')
param namePrefix string = 'amr-api'

@description('Immutable production API image reference, preferably including a digest.')
param containerImage string

@description('PostgreSQL Flexible Server migration administrator login. The API uses the separate database-url secret.')
param postgresAdminLogin string = 'amr_migration_owner'

@secure()
@description('PostgreSQL migration administrator password. Supply through the deployment secret store; never commit it.')
param postgresAdminPassword string

@secure()
@description('TLS PostgreSQL URL for the least-privilege API login, stored in Key Vault as database-url.')
param databaseUrl string

@description('OIDC issuer URL for the production API.')
param authIssuer string

@description('OIDC audience accepted by the production API.')
param authAudience string

@description('HTTPS OIDC JWKS URL for the production API.')
param authJwksUrl string

@description('Required OIDC scope for API access tokens.')
param authRequiredScope string

@description('Keep one replica until shared admission and distributed rate limits have been proven.')
param minReplicas int = 1

@description('Maximum API replicas for this low-traffic candidate. Keep at one pending distributed admission proof.')
param maxReplicas int = 1

var suffix = uniqueString(resourceGroup().id, namePrefix)
var vnetName = '${namePrefix}-vnet-${suffix}'
var postgresName = '${namePrefix}-pg-${suffix}'
var postgresDnsName = 'privatelink.postgres.database.azure.com'
var environmentName = '${namePrefix}-env-${suffix}'
var workspaceName = '${namePrefix}-logs-${suffix}'
var insightsName = '${namePrefix}-insights-${suffix}'
var vaultName = toLower(take(replace('${namePrefix}${suffix}', '-', ''), 24))
var identityName = '${namePrefix}-identity-${suffix}'
var apiName = '${namePrefix}-${suffix}'
var keyVaultSecretsUserRole = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '4633458b-17de-408a-b874-0445c86b69e6'
)

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

resource databaseUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'database-url'
  properties: {
    value: databaseUrl
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

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: insightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
    // Keep source IPs out of telemetry; this package does not promise raw
    // request logging or an unredacted trace.
    DisableIpMasking: false
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  properties: {
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

resource api 'Microsoft.App/containerApps@2024-03-01' = {
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
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'database-url'
          keyVaultUrl: databaseUrlSecret.properties.secretUri
          identity: apiIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: containerImage
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
    postgresTls
  ]
}

output apiUrl string = 'https://${api.properties.configuration.ingress.fqdn}'
output postgresServerName string = postgres.name
output keyVaultName string = vault.name
output containerAppName string = api.name
