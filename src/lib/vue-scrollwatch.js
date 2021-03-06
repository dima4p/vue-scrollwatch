//   Scroll monitor component

import bezierEasing from 'bezier-easing'

const getOffsetTop = function (element) {
    let yPosition = 0
    let nextElement = element

    while (nextElement) {
        yPosition += (nextElement.offsetTop)
        nextElement = nextElement.offsetParent
    }
    return yPosition
}

let cubicBezierArray = [0.5, 0, 0.35, 1]
let blockWatch = false
let blockWatching = false
let adjustScrollPosition = true
let currentNode = {}
let duration = 600
let nodeList = {}
let nodeTops = {}
let scrollAnimationFrame = null
let scrollDom = document.scrollingElement
let scrollDomOffset = getOffsetTop(scrollDom)
let scrollTimer = null
let scrollTimerDelay = 150

const scrollDone = new Event('scroll_watch_done')

const handleScroll = function (scroll) {
  if (scrollTimer != null) {
    clearTimeout(scrollTimer)
  }
  scrollTimer = setTimeout(function() {
    let scrollTop = scrollDom.scrollTop
    let result = null
    if (Object.keys(nodeList).length != Object.keys(nodeTops).length) {
      nodeTops = {}
      for (let name in nodeList) {
        nodeTops[nodeList[name].top] = nodeList[name].name
      }
    }
    let tops = Object.keys(nodeTops).sort((a, b) => a - b)
    let last = tops.length - 1
    if (last <= 0) return

    let first_node_offset = nodeList[nodeTops[tops[0]]].el.offsetTop
    result = find_current(tops, scrollTop + first_node_offset, 0, last)
    if (blockWatch) {
      blockWatch = false
    } else {
      dealResult(currentNode, result, tops)
    }
    currentNode.el = result.el
    currentNode.name = result.name
    currentNode.top = result.top
    scrollDom.dispatchEvent(scrollDone)
  }, scrollTimerDelay)
}

const find_current = function(tops, threshold, first, last) {
  if (first == last) return nodeList[nodeTops[tops[first]]]
  let mid = Math.floor((first + last) / 2)
  let top = Number(tops[mid])
  if (top <= threshold && Number(tops[mid + 1]) > threshold) {
    return nodeList[nodeTops[tops[mid]]]
  }
  if (top <= threshold) {
    return find_current(tops, threshold, mid + 1, last)
  } else {
    return find_current(tops, threshold, first, mid - 1)
  }
}

const dealResult = function (startNode, endNode, tops) {
  let start = tops.indexOf(startNode.top.toString())
  let end = tops.indexOf(endNode.top.toString())
  if (start == end) return
  let step = start < end ? 1 : -1
  start += step
  for (; step > 0 ? start <= end : start >= end; start += step) {
    let node = nodeList[nodeTops[tops[start]]]
    if (node && node.callback)
        node.callback(node)
  }
}

const scrollTo = function (name) {
  let promise = new Promise(function (resolve, reject) {
    if (blockWatching) blockWatch = true
    let target_node = nodeList[name]
    if (!target_node) {reject(name)}
    const startingY = scrollDom.scrollTop
    const difference =
        getOffsetTop(target_node.el) - scrollDomOffset - startingY
    const easing = bezierEasing(...cubicBezierArray)
    let start = null
    const step = (timestamp) => {
        if (!start) start = timestamp
        let progress = timestamp - start >= duration ? duration : (timestamp - start)
        let progressPercentage = progress / duration
        const perTick = startingY + (easing(progressPercentage) * (difference - target_node.offset))

        moveTo(perTick)

        if (progress < duration) {
          scrollAnimationFrame = window.requestAnimationFrame(step)
        } else {
          resolve(target_node)
        }
    }
    window.requestAnimationFrame(step)
  })
  return promise
}

const moveTo = function(scrollTop){
    scrollDom.scrollTop = scrollTop
}

const updateNodeList = function(el, binding, vnode, fn) {
  if (Object.keys(nodeList).length == 0) {
      scrollDom.addEventListener('scroll', handleScroll)
  }

  let { name, offset=0, callback } = binding.value
  let top = el.offsetTop - offset
  el.attributes.name = name

  if (!currentNode.top) {
    currentNode.el = el
    currentNode.name = name
    currentNode.top = top
  }

  if (adjustScrollPosition &&
        currentNode.name && currentNode.name == name &&
        top - currentNode.top != 0) {
    blockWatch = true
    scrollDom.scrollTop = scrollDom.scrollTop + top - currentNode.top
  }

  if (name in nodeList) {
    delete nodeTops[nodeList[name].top]
  }
  nodeList[name] = { name, offset, top: top, el, callback }
  nodeTops[top] = name
}

let vueScrollwatch={}
vueScrollwatch.install = function (Vue) {
    Vue.directive('scrollWatch', {
        inserted: function (el, binding, vnode) {
          updateNodeList(el, binding, vnode, 'inserted')
        },

        unbind: function (el, binding, vnode) {
          delete nodeTops[nodeList[binding.value.name].top]
          delete nodeList[binding.value.name]
          if (Object.keys(nodeList).length == 0 && scrollDom) {
              scrollDom.removeEventListener('scroll', handleScroll)
              scrollDom = document.scrollingElement
              scrollDomOffset = getOffsetTop(scrollDom)
          }

          // If it is animating, stop
          cancelAnimationFrame(scrollAnimationFrame)
        },

        update: function (el, binding, vnode) {
          updateNodeList(el, binding, vnode, 'update')
        },
    })
}

const setBlockWatchOnJump = function(value) {
  blockWatching = !!value
}

const setContainer = function (css_selector) {
  scrollDom = document.querySelector(css_selector)
  if(!scrollDom){
    throw `[vue-scrollwatch] Element '${css_selector}' was not found.`
  }
  scrollDomOffset = getOffsetTop(scrollDom)
}

const setAdjustPositionAfterInsertion = function(value) {
  adjustScrollPosition = !!value
}

const setScrollTimerDelay = function(delay){
  scrollTimerDelay = delay
}

vueScrollwatch.currentNode = currentNode
vueScrollwatch.scrollTo = scrollTo
vueScrollwatch.setBlockWatchOnJump = setBlockWatchOnJump
vueScrollwatch.setContainer = setContainer
vueScrollwatch.setAdjustPositionAfterInsertion = setAdjustPositionAfterInsertion
vueScrollwatch.setScrollTimerDelay = setScrollTimerDelay
export default vueScrollwatch
