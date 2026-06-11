import React, {PureComponent, ReactChildren} from 'react'

interface Props {
  children?: ReactChildren | JSX.Element | JSX.Element[]
  title: string
}

class OverlayHeading extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {title, children} = this.props

    return (
      <div className="overlay--heading">
        <div className="overlay--title">{title}</div>
        {children && children}
      </div>
    )
  }
}
export default OverlayHeading
