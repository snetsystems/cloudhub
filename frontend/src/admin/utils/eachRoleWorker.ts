import {Me} from 'src/types'

interface Auth {
  isUsingAuth: boolean
  me: Me
}

interface Database {
  name: string
  isEditing: boolean
}

export const eachRoleDatabases = (databases: Database[], auth: Auth) => {
  const {me, isUsingAuth} = auth
  let checkDatabases: {}
  if (isUsingAuth) {
    if (me.superAdmin) {
      checkDatabases = databases
    } else {
      checkDatabases = databases.filter(
        database => database.name === me.currentOrganization.name
      )
    }
  } else {
    checkDatabases = databases
  }
  return checkDatabases
}

export const eachRoleQueries = (databases: string[], auth: Auth) => {
  const {me, isUsingAuth} = auth
  let checkDatabases: {}
  if (isUsingAuth) {
    if (me.superAdmin) {
      checkDatabases = databases
    } else {
      checkDatabases = databases.filter(
        database => database === me.currentOrganization.name
      )
    }
  } else {
    checkDatabases = databases
  }
  return checkDatabases
}
