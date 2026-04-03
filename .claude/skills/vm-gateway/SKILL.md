---
name: vm-gateway
description: Manage Firecracker VMs via the Gateway API
auto_generated: true
---

## When to Use
When you need to create, list, manage, or delete lightweight VMs for testing, deployment, or sandboxed execution.

## Procedure
1. Use the GATEWAY TO HEAVEN tab in the top bar
2. Create VM: select tier (nano/micro), click CREATE MY VM
3. Open terminal: click OPEN TERMINAL button
4. Sync auth: click SYNC CLAUDE AUTH to authenticate claude in the VM
5. Delete: click DELETE VM when done

## Tiers
- nano: 1 vCPU, 512 MB RAM
- micro: 2 vCPU, 1 GB RAM

## Pitfalls
- Max 20 VMs. One VM per user.
- VMs are ephemeral — data is lost on delete.
- Auth sync copies your local Claude token to the VM.
- VM creation takes 2-3 seconds.

## Verification
- Green dot = VM running. Red dot = offline.
- "CLAUDE AUTHED" = claude CLI works inside VM.
