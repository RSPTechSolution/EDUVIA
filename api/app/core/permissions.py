from functools import wraps
from fastapi import HTTPException, Depends
from app.core.dependencies import get_current_user

PERMISSIONS = {
    "students.view":   ["ADMIN","TEACHER","ACCOUNTANT"],
    "students.create": ["ADMIN"],
    "students.edit":   ["ADMIN"],
    "students.delete": ["ADMIN"],
    "fees.view":       ["ADMIN","ACCOUNTANT"],
    "fees.collect":    ["ADMIN","ACCOUNTANT"],
    "attendance.mark": ["ADMIN","TEACHER"],
    "users.manage":    ["ADMIN"],
    "schools.manage":  ["SUPERADMIN"],
}

def require_permission(permission: str):
    async def checker(current_user=Depends(get_current_user)):
        allowed = PERMISSIONS.get(permission, [])
        if current_user.role not in allowed and current_user.role != "SUPERADMIN":
            raise HTTPException(status_code=403, detail=f"Permission denied: {permission}")
        return current_user
    return checker
