/** Branded IDs — never invent IDs; only use values from the Vercel API. */

export type TeamID = string & { readonly __brand: 'TeamID' };
export type ProjectID = string & { readonly __brand: 'ProjectID' };
export type DeploymentID = string & { readonly __brand: 'DeploymentID' };

export function teamID(raw: string): TeamID {
  return raw as TeamID;
}

export function projectID(raw: string): ProjectID {
  return raw as ProjectID;
}

export function deploymentID(raw: string): DeploymentID {
  return raw as DeploymentID;
}
