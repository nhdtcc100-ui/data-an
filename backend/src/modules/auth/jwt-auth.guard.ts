import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  workspaces: { workspaceId: string; role: 'owner' | 'editor' | 'viewer' }[];
}

@Injectable()
export class MultiTenantWorkspaceGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('يجب تسجيل الدخول للوصول إلى هذا المورد');
    }

    const token = authHeader.split(' ')[1];
    let decoded: AuthenticatedUser;

    try {
      decoded = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'super_secret_enterprise_jwt_key_2026_modern_bi_platform_key!',
      });
      request.user = decoded;
    } catch {
      throw new UnauthorizedException('رمز المصادقة غير صالح أو منتهي الصلاحية');
    }

    // Validate Multi-Tenancy Scope if workspaceId is present in params
    const workspaceId = request.params.workspaceId || request.params.id;
    if (workspaceId) {
      const membership = decoded.workspaces?.find((w) => w.workspaceId === workspaceId);
      if (!membership) {
        throw new ForbiddenException('ليس لديك صلاحية وصول لمساحة العمل المحددة (Tenant Isolation)');
      }
      request.workspaceRole = membership.role;
    }

    return true;
  }
}
