export type EmailTemplateType =
  | 'VERIFY_EMAIL'
  | 'PASSWORD_RESET'
  | 'WORKSPACE_INVITE'
  | 'SECURITY_ALERT';

export interface EmailJobPayload {
  to: string;
  template: EmailTemplateType;
  data: Record<string, any>;
  idempotencyKey: string;
  userId?: string;
  workspaceId?: string;
}

export interface ResendWebhookEvent {
  type: 'email.sent' | 'email.delivered' | 'email.delivery_delayed' | 'email.complained' | 'email.bounced' | 'email.opened' | 'email.clicked';
  created_at: string;
  data: {
    created_at: string;
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    broadcast_id?: string;
  };
}
