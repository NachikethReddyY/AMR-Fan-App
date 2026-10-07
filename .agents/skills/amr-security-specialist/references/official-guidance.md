# Security review references

Consulted 2026-09-28 (UTC). These are primary guidance links and the decisions they support in this skill.

- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
  Use allowlisted types, signature/content checks, size limits, authorized uploaders, safe storage and malware/CDR controls where applicable. MIME alone is spoofable; generated names and bounded retrieval matter.
- OWASP LLM Prompt Injection Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
  Treat direct, indirect and multimodal instructions as untrusted; separate data from instructions; use least privilege, output validation and human review for consequential decisions. This supports tool-free classification and deterministic points/approval policy.
- Microsoft managed identities overview: https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview
  Managed identity can remove long-lived Azure credentials from application configuration, but identity scope, role grants, network policy and readiness still require environment-specific proof. It does not prove provider or database isolation by itself.
