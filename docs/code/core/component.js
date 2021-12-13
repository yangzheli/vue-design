import { reactive, watchEffect } from './reactive.js'
import { h, createElement, renderStatic, mount, patch } from './render.js'
import { parse, generate } from './compile.js'
import { isHTMLTag } from './util.js'

let uid = 0
const proxyHandler = {
    get(target, key) {
        if (typeof key === 'string' && key.charAt(0) !== '_' && !(key in target)) {
            return target.data[key]
        }
        return target[key]
    },
    set(target, key, value, receiver) {
        if (typeof key === 'string' && key.charAt(0) !== '_' && !(key in target)) {
            target.data[key] = value
        } else {
            target[key] = value
        }
        return true
    },
    has(target, key) {
        return key in target || (typeof key === 'string' && key in target.data)
    }
}

// 创建组件实例
function createComponentInstance(options) {
    const instance = {
        uid: uid++,
        data: reactive(options.data),
        template: options.template,
        render: options.render,
        _c: createElement,
        _r: renderStatic
    }
    if (!instance.render) {
        const ast = parse(instance.template)
        const { render, staticRenderFns } = generate(ast)
        instance.render = render
        instance.staticRenderFns = staticRenderFns
    }
    instance.proxy = new Proxy(instance, proxyHandler)
    return instance
}

// 创建根组件，返回应用实例
export function createApp(options) {
    const app = createComponentInstance(options)
    app.components = {}

    // 注册非根组件
    app.component = function (name, component) {
        if (isHTMLTag(name)) {
            throw "Do not use reserved HTML elements as component id."
        }
        if (app.components[name]) {
            throw "Component has already been registered."
        }
        app.components[name] = component
        return app
    }

    app.mountApp = container => {
        let prevVnode = container.vnode
        const { render, proxy } = app
        watchEffect(() => {
            if (prevVnode == null) {
                // 挂载生成的 VNode
                prevVnode = container.vnode = render.call(proxy)
                mount(prevVnode, container)
            } else {
                // 更新 VNode
                const vnode = container.vnode = render.call(proxy)
                patch(prevVnode, vnode)
                prevVnode = vnode
            }
        })
        return proxy
    }
    return app
}

// 返回非根组件 VNode
export function createComponent(tag, props, children) {
    const options = this.components[tag]
    if (!options) return h(tag, props, children)
    const component = createComponentInstance(options)
    const { render, proxy } = component
    const vnode = render.call(proxy)
    return vnode
}