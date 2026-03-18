export interface BuildInfo {
  version: string
  environment: string
  git: {
    branch: string
    commitHash: string
    shortHash: string
    isDirty: boolean
  }
  timestamp: {
    iso: string
    unix: number
    formatted: {
      utc: string
      est: string
      pst: string
    }
  }
  builder: {
    node: string
    platform: string
    arch: string
  }
}
