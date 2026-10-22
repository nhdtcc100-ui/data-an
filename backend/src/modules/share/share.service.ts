import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

export interface PublicShareLink {
  token: string;
  dashboardId: string;
  hasPassword: boolean;
  expiresAt: Date | null;
  isActive: boolean;
}

@Injectable()
export class ShareService {
  /**
   * Generates a secure, cryptographically random public token
   */
  generatePublicToken(prefix = 'bi_pub'): string {
    return `${prefix}_${crypto.randomBytes(24).toString('hex')}`;
  }

  /**
   * Hashes optional password for share link protection
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Validates access to a public share token
   */
  async validatePublicToken(
    tokenRecord: {
      public_token: string;
      dashboard_id: string;
      password_hash?: string;
      is_active: boolean;
      expires_at?: Date;
    },
    providedPassword?: string
  ): Promise<{ dashboardId: string }> {
    if (!tokenRecord.is_active) {
      throw new NotFoundException('تم إلغاء تنشيط رابط المشاركة هذا من قبل المسؤول');
    }

    if (tokenRecord.expires_at && new Date() > new Date(tokenRecord.expires_at)) {
      throw new UnauthorizedException('انتهت صلاحية رابط المشاركة العام');
    }

    if (tokenRecord.password_hash) {
      if (!providedPassword) {
        throw new UnauthorizedException('هذا التقرير محمي بكلمة مرور. يرجى إدخال الرمز السري');
      }
      const match = await bcrypt.compare(providedPassword, tokenRecord.password_hash);
      if (!match) {
        throw new UnauthorizedException('كلمة المرور غير صحيحة');
      }
    }

    return { dashboardId: tokenRecord.dashboard_id };
  }
}
