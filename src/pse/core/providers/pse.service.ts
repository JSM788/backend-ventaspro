import { Injectable, Inject } from '@nestjs/common';
import type { IPseProvider } from './pse.provider.interface';
import { PseEmitResponse } from './pse.provider.interface';

export const PSE_PROVIDER_TOKEN = 'PSE_PROVIDER_TOKEN';

@Injectable()
export class PseService {
  constructor(
    @Inject(PSE_PROVIDER_TOKEN)
    private readonly provider: IPseProvider,
  ) {}

  async emitir(comprobanteId: string): Promise<PseEmitResponse> {
    return this.provider.emitir(comprobanteId);
  }

  async consultarEstado(comprobanteId: string, ticket?: string): Promise<PseEmitResponse> {
    return this.provider.consultarEstado(comprobanteId, ticket);
  }
}
