import React from 'react'
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import {ToggleEsWizard} from 'src/types/elasticSearch'

interface Props {
  toggleEsWizard: ToggleEsWizard
}

function ElasticTableHeader({toggleEsWizard}: Props) {
  return (
    <div className="panel-heading">
      <h2 className="panel-title">Elasticsearch Connection</h2>
      <Authorized requiredRole={EDITOR_ROLE}>
        <div className="btn btn-sm btn-primary" onClick={toggleEsWizard(true)}>
          <span className="icon plus" /> Add Connection
        </div>
      </Authorized>
    </div>
  )
}

export default ElasticTableHeader
