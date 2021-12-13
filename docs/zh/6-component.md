## 组件定义

在构建一个应用时，我们常常会把它拆分为各种组件，通过将不同的功能封装为组件，并组合它们就能形成页面与应用。

为了能将组件渲染为 `DOM` 元素，组件中需要哪些内容呢？我们先来看看 `Vue2` 中如何定义一个组件：

```js
Vue.component('button-counter', {
    data: function () {
        return {
            count: 0
        }
    },
    template: `<button v-on:click="count++">{{ count }}</button>`
})
```

组件中包含数据以及模板，当然也可以不用模板，直接使用渲染函数 `render`，前面我们已经讲过模板最终也是渲染函数。

在之前实现响应性更新时，实际上我们已经定义过组件，对于挂载对象我们如下进行的封装：

```js
const App = {
    data: reactive({
        msg: 'hello world'
    }),
    render() {
        return h('div', { onClick: () => this.data.msg = 'so cool' }, this.data.msg)
    }
}
```

可以看到，组件实际上就是对数据和 `render` 函数的封装。组件的核心是渲染函数 `render`，而`data` 以及其它方法、钩子函数等都是为 `render` 函数提供数据的。另外，渲染函数返回的是 `VNode`，因此组件最终返回的也是 `VNode`。

了解什么是组件后，接下来我们就来创建组件。首先，我们将组件分为两种：根组件与非根组件。

* 根组件返回整个应用实例，它将被挂载到容器上；

* 非根组件可以作为标签在根组件的模板中使用，当然非根组件之间也可以相互嵌套。

我们首先定义一个公共方法 `createComponentInstance` 为所有组件返回一个组件实例。在该方法中，我们为每个返回的组件实例添加唯一的 `uid`，由于根组件最先被创建，因此根组件的 `uid` 为 0。另外，对初始化参数中的 `data` 属性进行监听，将模板编译为渲染函数，并在返回实例中添加属性 `proxy` 作为它的代理对象。

```js
import { reactive } from './reactive.js'
import { createElement } from './render.js'
import { parse, generate } from './compile.js'

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
        _c: createElement
    }
    if (!instance.render) {
        const ast = parse(instance.template)
        const { render } = generate(ast)
        instance.render = render
    }
    instance.proxy = new Proxy(instance, proxyHandler)
    return instance
}
```

对于根组件，由于它返回的是整个应用实例，因此返回实例中除了包含 `createComponentInstance` 方法添加的属性，还需要定义属性 `component` 注册其中的非根组件、以及 `mountApp` 将根组件挂载到容器上。由于注册的非根组件可能在根组件的模板中并没有使用，因此非根组件注册时并不直接生成 `VNode`。而 `mountApp` 方法和之前一样，我们将根组件返回 `VNode` 的挂载、更新作为依赖添加进 `watchEffect` 中，最终我们返回代理对象 `proxy`，这样就能直接访问到 `data` 的 `property`。

```js
import { watchEffect } from './reactive.js'
import { mount, patch } from './render.js'
import { isHTMLTag } from './util.js'

// 创建根组件，返回应用实例
function createApp(options) {
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
```

对于非根组件，当它在根组件的模板中使用，挂载根组件时会调用生成的渲染函数。如果不在返回 `VNode` 前进行处理，`mount` 挂载时将生成该组件名的标签。因此，我们在 `createElement` 方法中调用 `createComponent` 方法对组件进行处理，`createComponent` 方法返回的就是该组件的 `VNode`。

```js{2-5}
function createElement(tag, props, children) {
    // component
    if (isDef(tag) && !isHTMLTag(tag)) {
        return createComponent.call(this, tag, props, children)
    }

    // 省略

    return h(tag, props, children)
}

// 返回非根组件 VNode
function createComponent(tag, props, children) {
    const options = this.components[tag]
    if (!options) return h(tag, props, children)
    const component = createComponentInstance(options)
    const { render, proxy } = component
    const vnode = render.call(proxy)
    return vnode
}
```

这样，就能在根组件的模板中使用子组件。

```js
const app = createApp({
    data: {
        msg: 'This is a message'
    },
    template: `<div>
                    <div>{{ msg }}</div>
                    <HelloWorld></HelloWorld>
                </div>`
})

app.component('HelloWorld',{
    data: {
        msg: 'hello world'
    },
    template: `<div>{{ msg }}</div>`
})

const container = document.getElementById('app')
const vm = app.mountApp(container)

vm.msg = 'A new message'
```

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/abLBjdB)
:::

<!-- ## 组件间数据传递

## 动态组件 -->