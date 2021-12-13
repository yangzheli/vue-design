上一节我们实现了模板编译，并成功将 `template` 挂载到指定容器上，但是由于我们并没有对数据进行监听，因此并不能响应式更新 `View`。这一节我们将使用 `reactive` 方法跟踪模板中绑定对象的变化，在监听对象变化后调用 `patch` 实现 `Model` 和 `View` 的响应性更新。

和之前一样，我们同样先将需要跟踪的对象作为 `data` 的 `property`，并使用 `reactive` 方法监听对象的变化。同时为了在 `App` 对象中也能访问到 `data` 的 `property`，我们再进行一次代理，将 `App` 对象作为返回的代理对象，定义 `handler` 在需要时返回 `data` 中的属性值。

```js
import { reactive } from '../core/reactive.js'
import { createElement } from '../core/render.js'

const proxyHandler = {
    get(target, key) {
        if (typeof key === 'string' && !(key in target)) {
            return target.data[key]
        }
        return target[key]
    },
    set(target, key, value, receiver) {
        if (typeof key === 'string' && !(key in target)) {
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

const ctx = {
    data: reactive({
        isActive: true,
        errorClass: 'error',
        msg: 'This is a message',
    }),
    _c: createElement,
}
const App = new Proxy(ctx, proxyHandler)
```

接下来就调用模板编译中的 `parse` 与 `generate` 方法解析 `template` 并生成渲染函数 `render`。和之前一样，我们将其作为依赖添加进 `watchEffect` 中，使用 `call` 方法将渲染函数中的 `this` 改为挂载对象。如果是初次挂载则调用 `mount` 方法，否则就调用 `patch` 方法对已经挂载的旧 `VNode` 进行更新。

```js
import { reactive, watchEffect } from '../core/reactive.js'
import { createElement, mount, patch } from '../core/render.js'
import { parse, generate } from '../core/compile.js'

const template = `<div :class="[{ active: isActive }, errorClass]" class="static">
                    <input type="text" name="input" value="hello world">
                    <p>Message: {{ msg }}</p>
                </div>`

const ast = parse(template)
const render = generate(ast).render

function mountApp(component, container) {
    let prevVnode = container.vnode
    watchEffect(() => {
        if (prevVnode == null) {
            // 挂载生成的 VNode
            prevVnode = container.vnode = render.call(component)
            mount(prevVnode, container)
        } else {
            // 更新 VNode
            const vnode = container.vnode = render.call(component)
            patch(prevVnode, vnode)
            prevVnode = vnode
        }
    })
}
```

最后只需调用 `mountApp` 方法就实现了 `Model` 和 `View` 之间的响应性更新，同时直接在 `App` 对象下修改 `data` 的 `property` 也能触发更新。

```js
const container = document.getElementById('app')
mountApp(App, container)

App.data.msg = 'A new message'
App.isActive = false
```           

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/OJxXmpB)
:::