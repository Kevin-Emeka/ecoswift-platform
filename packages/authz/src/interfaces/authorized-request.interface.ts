/**
 * The minimal shape every guard in this package needs from the
 * authenticated request — deliberately just `userId`, not the full
 * `AuthenticatedUser` shape `auth-service`'s `JwtStrategy` produces, so any
 * service's own auth layer can satisfy this contract without depending on
 * `auth-service` directly.
 */
export interface AuthorizedRequestUser {
  userId: string;
}

export interface AuthorizedRequest {
  user?: AuthorizedRequestUser;
  apiKey?: {
    id: string;
    scopes: string[];
    ownerUserId?: string;
  };
}
