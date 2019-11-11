import React, {PureComponent} from 'react'
import axios from 'axios'

class TestAPI extends PureComponent {
  constructor(props) {
    super(props)

    // this.testAPI = this.testAPI.bind(this)

    this.state = {
      response: '',
    }

    this.ajaxTest = this.ajaxTest.bind(this)
  }

  public ajaxTest = async () => {
    try {
      console.log('ajaxTest 실행')
      return await axios.get({url: 'http://61.250.122.43:3333/run'})
    } catch (error) {
      console.error(error)
    }
  }

  public async componentDidMount() {
    const test = this.ajaxTest()
  }

  render() {
    const {response} = this.state
    return <div className="panel panel-solid"> {response} </div>
  }
}

export default TestAPI
