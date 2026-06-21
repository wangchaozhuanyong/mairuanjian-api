export interface WebCheckGatewayAttemptDto {
  nodeId?: string | null;
  status?: 'success' | 'failed';
  exitIp?: string | null;
  exitCountry?: string | null;
  latencyMs?: number | null;
  failureReason?: string | null;
}
