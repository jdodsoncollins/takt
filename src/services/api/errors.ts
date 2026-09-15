export type VercelAPIErrorKind =
  | 'rateLimited'
  | 'unauthorized'
  | 'notFound'
  | 'forbidden'
  | 'invalidResponse'
  | 'decodeFailed'
  | 'network';

export class VercelAPIError extends Error {
  readonly kind: VercelAPIErrorKind;
  readonly status?: number;
  readonly resource?: string;

  constructor(
    kind: VercelAPIErrorKind,
    message: string,
    opts?: { status?: number; resource?: string },
  ) {
    super(message);
    this.name = 'VercelAPIError';
    this.kind = kind;
    this.status = opts?.status;
    this.resource = opts?.resource;
  }

  static unauthorized(): VercelAPIError {
    return new VercelAPIError(
      'unauthorized',
      'Vercel token missing, expired, or insufficient scope. Update the token in Settings.',
      { status: 401 },
    );
  }

  static forbidden(): VercelAPIError {
    return new VercelAPIError(
      'forbidden',
      'Vercel denied access to this resource. Check team membership and token scope.',
      { status: 403 },
    );
  }

  static notFound(resource?: string): VercelAPIError {
    return new VercelAPIError('notFound', 'Resource not found on Vercel.', {
      status: 404,
      resource,
    });
  }

  static rateLimited(): VercelAPIError {
    return new VercelAPIError(
      'rateLimited',
      'Vercel rate limit hit. Wait a moment and retry.',
      { status: 429 },
    );
  }

  static invalidResponse(): VercelAPIError {
    return new VercelAPIError(
      'invalidResponse',
      'Vercel returned an invalid response.',
    );
  }

  static decodeFailed(resource: string, _detail?: string): VercelAPIError {
    return new VercelAPIError(
      'decodeFailed',
      'Could not parse the Vercel response.',
      { resource },
    );
  }

  static network(_detail?: string): VercelAPIError {
    return new VercelAPIError('network', 'Could not reach Vercel.');
  }
}
