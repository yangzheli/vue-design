import { createComponent } from './component.js'
import { isHTMLTag, isUndef, isDef, concat } from './util.js'

let cbs = [
    function updateClass(props) {
        const klass = concat(props.class, stringifyClass(props.bindingClass))
        if (klass) props.class = klass
        delete props.bindingClass

        function stringifyClass(value) {
            let res = ''
            if (Array.isArray(value)) {
                for (let i = 0, len = value.length; i < len; i++) {
                    let stringifyed = stringifyClass(value[i])
                    if (isDef(stringifyed) && stringifyed !== '') {
                        if (res) res += ' '
                        res += stringifyed
                    }
                }
                return res
            } else if (typeof value === 'object') {
                for (let key in value) {
                    if (value[key]) {
                        if (res) res += ' '
                        res += key
                    }
                }
                return res
            } else {
                return value
            }
        }
    },
    // other hooks
]

export function h(tag, props, children) {
    const key = props ? props.key : undefined
    if (!children) children = []
    if (Array.isArray(children)) {
        for (let i = 0, len = children.length; i < len; i++) {
            if (typeof children[i] === 'string') children[i] = h(undefined, undefined, children[i])
        }
    }
    return { tag: tag, props: props, children: children, key: key }
}

export function createElement(tag, props, children) {
    if (isDef(tag) && !isHTMLTag(tag)) {
        // component
        return createComponent.call(this, tag, props, children)
    }

    if (props) {
        for (let i = 0, len = cbs.length; i < len; i++) {
            cbs[i].call(this, props)
        }
    }

    return h(tag, props, children)
}

// render static
export function renderStatic(index) {
    let cached = this._staticVnodes || (this._staticVnodes = [])
    let vnode = cached[index]
    if (vnode) return vnode
    vnode = cached[index] = this.staticRenderFns[index].call(this)
    return vnode
}

export function mount(vnode, container) {
    if (vnode.tag) vnode.el = document.createElement(vnode.tag)
    else vnode.el = document.createTextNode(vnode.child)
    const el = vnode.el

    // props
    if (vnode.props) {
        for (const key in vnode.props) {
            const value = vnode.props[key]
            if (key.startsWith('on')) {
                el.addEventListener(key.slice(2).toLowerCase(), value)
            } else {
                el.setAttribute(key, vnode.props[key])
            }
        }
    }

    // children
    if (vnode.children) {
        if (typeof vnode.children === 'string') {
            el.textContent = vnode.children
        } else {
            vnode.children.forEach(child => {
                mount(child, el)
            })
        }
    }

    container.appendChild(el)
}

export function patch(oldVnode, vnode) {
    if (vnode === oldVnode) return
    const el = (vnode.el = oldVnode.el)

    if (isUndef(oldVnode.tag) && isUndef(vnode.tag)) {	// ????????????
        if (vnode.children !== oldVnode.children) el.textContent = vnode.children
    } else if (vnode.tag === oldVnode.tag) {
        // props
        const oldProps = oldVnode.props || {}
        const newProps = vnode.props || {}
        for (const key in newProps) {
            const oldValue = oldProps[key]
            const newValue = newProps[key]
            if (newValue !== oldValue) {
                if (key.startsWith('on')) {
                    el.removeEventListener(key.slice(2).toLowerCase(), oldValue)
                    el.addEventListener(key.slice(2).toLowerCase(), newValue)
                } else {
                    el.setAttribute(key, newValue)
                }
            }
        }
        for (const key in oldProps) {
            if (!(key in newProps)) {
                if (key.startsWith('on')) {
                    el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key])
                } else {
                    el.removeAttribute(key)
                }
            }
        }

        // children
        const oldChildren = oldVnode.children
        const newChildren = vnode.children
        if (typeof oldChildren === 'string') {
            if (typeof newChildren === 'string') {
                if (newChildren !== oldChildren) {
                    el.textContent = newChildren
                }
            } else {
                el.innerHTML = ''
                newChildren.forEach(child => {
                    mount(child, el)
                })
            }
        } else {
            if (typeof newChildren === 'string') {
                el.textContent = newChildren
            } else {
                updateChildren(el, oldChildren, newChildren)
            }
        }
    } else {
        const parent = el.parentNode
        parent.removeChild(el)
        mount(vnode, parent)
    }
}

function updateChildren(parent, oldChildren, newChildren) {
    let oldStartIdx = 0
    let oldEndIdx = oldChildren.length - 1
    let newStartIdx = 0
    let newEndIdx = newChildren.length - 1

    let oldStartVnode = oldChildren[0]
    let oldEndVnode = oldChildren[oldEndIdx]
    let newStartVnode = newChildren[0]
    let newEndVnode = newChildren[newEndIdx]

    let oldKeyToIdx = {}
    for (let i = 0; i <= oldEndIdx; i++) {
        const key = oldChildren[i].key
        if (key !== undefined) {
            oldKeyToIdx[key] = i
        }
    }

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
        if (oldStartVnode === null) {
            oldStartVnode = oldChildren[++oldStartIdx]
        } else if (oldEndVnode === null) {
            oldEndVnode = oldChildren[--oldEndIdx]
        } else if (oldStartVnode.key === newStartVnode.key) {
            patch(oldStartVnode, newStartVnode)
            oldStartVnode = oldChildren[++oldStartIdx]
            newStartVnode = newChildren[++newStartIdx]
        } else if (oldEndVnode.key === newEndVnode.key) {
            patch(oldEndVnode, newEndVnode)
            oldEndVnode = oldChildren[--oldEndIdx]
            newEndVnode = newChildren[--newEndIdx]
        } else if (oldEndVnode.key === newStartVnode.key) {
            patch(oldEndVnode, newStartVnode)
            // ????????????
            parent.insertBefore(oldEndVnode.el, oldStartVnode.el)
            oldEndVnode = oldChildren[--oldEndIdx]
            newStartVnode = newChildren[++newStartIdx]
        } else if (oldStartVnode.key === newEndVnode.key) {
            patch(oldStartVnode, newEndVnode)
            // ????????????
            parent.insertBefore(oldStartVnode.el, oldEndVnode.el.nextSibling)
            oldStartVnode = oldChildren[++oldStartIdx]
            newEndVnode = newChildren[--newEndIdx]
        } else {
            // ??????????????????????????? key ???????????????
            const indexInOld = oldKeyToIdx[newStartVnode.key]
            if (!indexInOld) {
                mount(newStartVnode, parent)
                parent.insertBefore(newStartVnode.el, oldStartVnode.el)
            } else {
                elemToMove = oldChildren[indexInOld]
                patch(elemToMove, newStartVnode)
                oldChildren[indexInOld] = null
                parent.insertBefore(elemToMove.el, oldStartVnode.el)
            }
            newStartVnode = newChildren[++newStartIdx]
        }
    }

    if (oldStartIdx > oldEndIdx) {
        // ???????????????
        for (; newStartIdx <= newEndIdx; ++newStartIdx) {
            newStartVnode = newChildren[newStartIdx]
            mount(newStartVnode, parent)
            const node = newChildren[newEndIdx + 1] == null ? null : newChildren[newEndIdx + 1].el
            parent.insertBefore(newStartVnode.el, node)
        }
    } else if (newStartIdx > newEndIdx) {
        // ????????????????????????
        for (; oldStartIdx <= oldEndIdx; ++oldStartIdx) {
            oldStartVnode = oldChildren[oldStartIdx]
            parent.removeChild(oldStartVnode.el)
        }
    }
}