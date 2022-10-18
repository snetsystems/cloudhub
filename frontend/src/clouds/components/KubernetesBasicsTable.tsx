import React, {PureComponent} from 'react'
import {TableBody, TableBodyRowItem} from 'src/addon/128t/reusable/layout'
import {KUBERNETES_BASICS_TABLE_SIZE} from 'src/clouds/constants/tableSizing'

interface Props {}

class KubernetesBasicsTable extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {HeaderWidth, DataWidth} = KUBERNETES_BASICS_TABLE_SIZE
    return (
      <>
        <TableBody>
          <>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: HeaderWidth}}
              >
                Status
              </div>
              <TableBodyRowItem
                title={'Pending'}
                width={DataWidth}
                className={'align--start'}
              />
            </div>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: HeaderWidth}}
              >
                Replica Set
              </div>
              <TableBodyRowItem
                title={'Pending'}
                width={DataWidth}
                className={'align--start'}
              />
            </div>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: HeaderWidth}}
              >
                Service Account Name
              </div>
              <TableBodyRowItem
                title={'Pending'}
                width={DataWidth}
                className={'align--start'}
              />
            </div>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: HeaderWidth}}
              >
                Labels
              </div>
              <TableBodyRowItem
                title={'Pending'}
                width={DataWidth}
                className={'align--start'}
              />
            </div>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: HeaderWidth}}
              >
                Node Name
              </div>
              <TableBodyRowItem
                title={'Pending'}
                width={DataWidth}
                className={'align--start'}
              />
            </div>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: HeaderWidth}}
              >
                Host IP
              </div>
              <TableBodyRowItem
                title={'Pending'}
                width={DataWidth}
                className={'align--start'}
              />
            </div>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: HeaderWidth}}
              >
                Pod IP
              </div>
              <TableBodyRowItem
                title={'Pending'}
                width={DataWidth}
                className={'align--start'}
              />
            </div>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: HeaderWidth}}
              >
                Phase
              </div>
              <TableBodyRowItem
                title={
                  <div>
                    <span
                      style={{
                        color: 'Running' === 'Running' ? 'yellowGreen' : 'red',
                      }}
                    >{`Running`}</span>
                    [{`Start Time: 2020-10-27T01:36:04.000Z`}]
                  </div>
                }
                width={DataWidth}
                className={'align--start'}
              />
            </div>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: HeaderWidth}}
              >
                Image
              </div>
              <TableBodyRowItem
                title={`kubernetesui/dashboard:v2.0.0`}
                width={DataWidth}
                className={'align--start'}
              />
            </div>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: HeaderWidth}}
              >
                Image Pull Pollicy
              </div>
              <TableBodyRowItem
                title={'Always'}
                width={DataWidth}
                className={'align--start'}
              />
            </div>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: HeaderWidth}}
              >
                Resources
              </div>
              <TableBodyRowItem
                title={'Pending'}
                width={DataWidth}
                className={'align--start'}
              />
            </div>
          </>
        </TableBody>
        <div>
          <div className={'devider--bar'}>Containers</div>
          <TableBody>
            <>
              <div className="hosts-table--tr">
                <div
                  className={'hosts-table--th align--start'}
                  style={{width: HeaderWidth}}
                >
                  Name
                </div>
                <TableBodyRowItem
                  title={'kubernetes-dashboard'}
                  width={DataWidth}
                  className={'align--start'}
                />
              </div>
              <div className="hosts-table--tr">
                <div
                  className={'hosts-table--th align--start'}
                  style={{width: HeaderWidth}}
                >
                  Image
                </div>
                <TableBodyRowItem
                  title={'kubernetes-dashboard'}
                  width={DataWidth}
                  className={'align--start'}
                />
              </div>
              <div className="hosts-table--tr">
                <div
                  className={'hosts-table--th align--start'}
                  style={{width: HeaderWidth}}
                >
                  Image Pull Pollicy
                </div>
                <TableBodyRowItem
                  title={'kubernetes-dashboard'}
                  width={DataWidth}
                  className={'align--start'}
                />
              </div>
              <div className="hosts-table--tr">
                <div
                  className={'hosts-table--th align--start'}
                  style={{width: HeaderWidth}}
                >
                  Container ID
                </div>
                <TableBodyRowItem
                  title={
                    'docker://a36103ab0b1abf1d3fc3aab54a0f303b2f51a585a30447fa9d4962ed6e3f0bc1'
                  }
                  width={DataWidth}
                  className={'align--start'}
                />
              </div>
              <div className="hosts-table--tr">
                <div
                  className={'hosts-table--th align--start'}
                  style={{width: HeaderWidth}}
                >
                  Container Port
                </div>
                <TableBodyRowItem
                  title={'8443/tcp, 3500/tcp'}
                  width={DataWidth}
                  className={'align--start'}
                />
              </div>
            </>
          </TableBody>
        </div>
      </>
    )
  }
}

export default KubernetesBasicsTable
