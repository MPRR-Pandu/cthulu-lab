# VM Manager

Python FastAPI service managing Firecracker microVMs.
Deployed on GCE instance: `cthulu-agents-api-01` (zone: asia-south1-c, project: bitcoin-auxiliary-services)
Location on VM: `/opt/vm-manager/vm_manager.py`

## Endpoints
- GET /health
- POST /vms — create VM
- GET /vms — list VMs
- GET /vms/:id — get VM
- DELETE /vms/:id — delete VM
- POST /vms/:id/exec — execute command inside VM (added by Cthulu Lab)
