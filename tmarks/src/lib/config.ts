interface EnvVars {
  JWT_ACCESS_TOKEN_EXPIRES_IN?: string;
  JWT_REFRESH_TOKEN_EXPIRES_IN?: string;
  ALLOW_REGISTRATION?: string;
  ENVIRONMENT?: string;
}

const DEFAULT_CONFIG = {
  JWT_ACCESS_TOKEN_EXPIRES_IN: '365d',
  JWT_REFRESH_TOKEN_EXPIRES_IN: '365d',
} as const;

function getEnv(): EnvVars {
  return {
    JWT_ACCESS_TOKEN_EXPIRES_IN: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN,
    JWT_REFRESH_TOKEN_EXPIRES_IN: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN,
    ALLOW_REGISTRATION: process.env.ALLOW_REGISTRATION,
    ENVIRONMENT: process.env.ENVIRONMENT,
  };
}

export function getJwtAccessTokenExpiresIn(): string {
  const env = getEnv();
  return env.JWT_ACCESS_TOKEN_EXPIRES_IN || DEFAULT_CONFIG.JWT_ACCESS_TOKEN_EXPIRES_IN;
}

export function getJwtRefreshTokenExpiresIn(): string {
  const env = getEnv();
  return env.JWT_REFRESH_TOKEN_EXPIRES_IN || DEFAULT_CONFIG.JWT_REFRESH_TOKEN_EXPIRES_IN;
}

export function isRegistrationAllowed(): boolean {
  const env = getEnv();
  return env.ALLOW_REGISTRATION === 'true';
}

export function getEnvironment(): 'development' | 'production' {
  const env = getEnv();
  return env.ENVIRONMENT === 'production' ? 'production' : 'development';
}


