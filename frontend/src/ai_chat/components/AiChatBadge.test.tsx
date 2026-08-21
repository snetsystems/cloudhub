import React from 'react'
import {shallow} from 'enzyme'
import {AiChatBadge} from './AiChatBadge'

describe('AiChatBadge', () => {
  it('renders default badge with children and nowrap class', () => {
    const wrapper = shallow(<AiChatBadge>테스트 배지</AiChatBadge>)

    expect(wrapper.hasClass('ai-chat-badge')).toBe(true)
    expect(wrapper.hasClass('variant-default')).toBe(true)
    expect(wrapper.hasClass('size-md')).toBe(true)
    expect(wrapper.hasClass('is-nowrap')).toBe(true)
    expect(wrapper.find('.ai-chat-badge-text').text()).toBe('테스트 배지')
  })

  it('renders done variant with checkmark icon', () => {
    const wrapper = shallow(
      <AiChatBadge variant="done" icon="✓">
        답변 완료
      </AiChatBadge>
    )

    expect(wrapper.hasClass('variant-done')).toBe(true)
    expect(wrapper.find('.done-icon').text()).toBe('✓')
    expect(wrapper.find('.ai-chat-badge-text').text()).toBe('답변 완료')
  })

  it('renders security variant with small size', () => {
    const wrapper = shallow(
      <AiChatBadge variant="blocked" size="sm">
        Security Gateway Intercepted
      </AiChatBadge>
    )

    expect(wrapper.hasClass('variant-blocked')).toBe(true)
    expect(wrapper.hasClass('size-sm')).toBe(true)
    expect(wrapper.find('.ai-chat-badge-text').text()).toBe(
      'Security Gateway Intercepted'
    )
  })

  it('handles click events and adds clickable class', () => {
    const handleClick = jest.fn()
    const wrapper = shallow(
      <AiChatBadge variant="category" onClick={handleClick}>
        Skill
      </AiChatBadge>
    )

    expect(wrapper.hasClass('is-clickable')).toBe(true)
    wrapper.simulate('click', {})
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('allows disabling nowrap when explicitly set to false', () => {
    const wrapper = shallow(
      <AiChatBadge nowrap={false}>긴 텍스트 배지</AiChatBadge>
    )

    expect(wrapper.hasClass('is-nowrap')).toBe(false)
  })
})
