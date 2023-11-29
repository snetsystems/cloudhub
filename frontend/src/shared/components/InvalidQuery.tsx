import React, {PureComponent} from 'react'

interface Props {
  message?: string
}

class InvalidQuery extends PureComponent<Props> {
  public render() {
    return <div className="graph-empty">{this.errorMessage}</div>
  }

  private get errorMessage(): JSX.Element {
    if (this.props.message) {
      return <p>{this.props.message}</p>
    }

    return (
      <>
        <p>
          In Static Graphs, including 'time' in the last 'GROUP BY' clause of a
          query is not supported.
        </p>
      </>
    )
  }
}

export default InvalidQuery
