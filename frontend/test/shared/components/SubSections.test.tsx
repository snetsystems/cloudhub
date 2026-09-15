import {shallow} from 'enzyme'
import React from 'react'
import SubSections from 'src/shared/components/SubSections'
import SubSectionsTab from 'src/shared/components/SubSectionsTab'

const Guava = () => {
  return <div />
}

const Mango = () => {
  return <div />
}

const Pineapple = () => {
  return <div />
}

const guavaURL = 'guava'
const mangoURL = 'mango'
const pineappleURL = 'pineapple'

const defaultProps = {
  router: {
    push: () => {},
    replace: () => {},
    go: () => {},
    goBack: () => {},
    goForward: () => {},
    setRouteLeaveHook: () => {},
    isActive: () => {},
  },
  sourceID: 'fruitstand',
  parentUrl: 'fred-the-fruit-guy',
  activeSection: guavaURL,
  sections: [
    {
      url: guavaURL,
      name: 'Guava',
      component: <Guava />,
      enabled: true,
    },
    {
      url: mangoURL,
      name: 'Mango',
      component: <Mango />,
      enabled: true,
    },
    {
      url: pineappleURL,
      name: 'Pineapple',
      component: <Pineapple />,
      enabled: false,
    },
  ],
}

const setup = (override?: {}) => {
  const props = {
    ...defaultProps,
    ...override,
  }

  return shallow(<SubSections {...props} />)
}

describe('SubSections', () => {
  describe('render', () => {
    it('renders the currently active tab', () => {
      const wrapper = setup()
      const content = wrapper.dive().find({'data-test': 'subsectionContent'})

      expect(content.find(Guava).exists()).toBe(true)
    })

    it('only renders enabled tabs', () => {
      const wrapper = setup()
      const nav = wrapper.dive().find({'data-test': 'subsectionNav'})

      const tabs = nav.find(SubSectionsTab)

      tabs.forEach(tab => {
        expect(tab.exists()).toBe(tab.props().section.enabled)
      })
    })
  })

  describe('a section the user may not open', () => {
    it('renders an enabled section instead of the disabled one', () => {
      // Reached by typing the URL: the tab for it is not on the page. The
      // redirect below only lands after mount, so rendering the disabled
      // component here would still mount the page for a paint.
      const wrapper = setup({activeSection: pineappleURL})
      const content = wrapper.dive().find({'data-test': 'subsectionContent'})

      expect(content.find(Pineapple).exists()).toBe(false)
      expect(content.find(Guava).exists()).toBe(true)
    })

    it('rewrites the URL to the first section left open', () => {
      const replace = jest.fn()
      const wrapper = setup({
        activeSection: pineappleURL,
        router: {...defaultProps.router, replace},
      })
      wrapper.dive()

      expect(replace).toHaveBeenCalledWith(
        `/sources/fruitstand/fred-the-fruit-guy/${guavaURL}`
      )
    })
  })
})
