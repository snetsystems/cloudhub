import React, {Component} from 'react'

import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {ErrorHandling} from 'src/shared/decorators/errors'

@ErrorHandling
class GettingStarted extends Component {
  public render() {
    return (
      <FancyScrollbar className="getting-started--container">
        <div className="getting-started">
          <div className="getting-started--cell intro">
            <h5>
              <span className="icon cubo-uniform" /> Welcome to CloudHub!
            </h5>
            <p>Follow the links below to explore CloudHub’s features.</p>
          </div>
          <div className="getting-started--cell">
            <p>
              <strong>
                <a
                  href="https://seversky.atlassian.net/wiki/spaces/CSHD/pages/217612473/Installation+guide/"
                  target="_blank"
                >
                  Install the CloudHub
                </a>
              </strong>
              <br />
              Save some time and use this handy tool to install the rest of the
              stack:
            </p>
            <p>
              <a
                href="https://seversky.atlassian.net/wiki/spaces/CSHD/pages/217022681/Installing+Server+Node#Install-Pre-required-Packages"
                target="_blank"
              >
                Install Component Stack
              </a>
              <br />
              <a
                href="https://seversky.atlassian.net/wiki/spaces/CSHD/pages/219873404/Getting+started/"
                target="_blank"
              >
                Getting started with quick guide
              </a>
            </p>
          </div>
          <div className="getting-started--cell">
            <p>
              <strong>Guides</strong>
            </p>
            <p>
              <a
                href="https://seversky.atlassian.net/wiki/spaces/CSHD/pages/219873413/User+Guides/"
                target="_blank"
              >
                User's guides for CloudHub
              </a>
              <br />
              <a
                href="https://seversky.atlassian.net/wiki/spaces/CSHD/pages/219447417/Administrator+s+Guides/"
                target="_blank"
              >
                Administrator's guides for CloudHub
              </a>
              <br />
              <a
                href="https://seversky.atlassian.net/wiki/spaces/CSHD/pages/279281813/Case+Study/"
                target="_blank"
              >
                Useful cases study
              </a>
              <br />
              <a
                href="https://seversky.atlassian.net/wiki/spaces/CSHD/pages/259817509/Advanced+Kapacitor+usage/"
                target="_blank"
              >
                Advanced Kapacitor Usage
              </a>
            </p>
          </div>
          <div className="getting-started--cell">
            <p>
              <strong>Release</strong>
            </p>
            <p>
              {/* If you have any product feedback please open a GitHub issue and
              we'll take a look. For any questions or other issues try posting
              on our&nbsp;
              <a href="https://community.snetsystems.com/" target="_blank">
                Community Forum
              </a>
              . */}
              <a
                href="https://github.com/snetsystems/cloudhub/releases/"
                target="_blank"
              >
                <span className="icon github" /> Release informations
              </a>
            </p>
            <p>
              <a
                href="https://github.com/snetsystems/telegraf/releases"
                target="_blank"
              >
                <span className="icon github" /> Collect Agent(Telegraf) Release
                information
              </a>
            </p>
          </div>
        </div>
      </FancyScrollbar>
    )
  }
}

export default GettingStarted
