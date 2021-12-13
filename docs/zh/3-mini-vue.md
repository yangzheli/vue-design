前面我们实现了 `Vue` 的响应性功能和渲染函数，实际上，通过组合它们我们就能实现 `Model` 和 `View` 之间的响应性更新。

当然，由于我们并没有实现模板编译，因此还不能通过模板语法来进行数据绑定，只能通过渲染函数来更新视图，之后实现模板编译后将会对其进一步改进。

之前实现的 `reactive` 方法能够监听对象的变化，我们跟踪指定对象的变化并返回 `VNode`。同时由于我们已经划分好响应性、渲染函数等各模块，因此这里我们将使用 `ES Module` 的方式引入各模块功能。

```js
import { reactive, watchEffect } from '../core/reactive.js'

const App = {
    data: reactive({
        msg: 'hello world'
    }),
    render() {
        return h('div', { onClick: () => this.data.msg = 'so cool' }, this.data.msg)
    }
}
```

而 `mount` 与 `patch` 方法能够挂载、更新 `VNode`，因此这部分代码也是需要重新执行的代码 - 依赖，我们将其添加进 `watchEffect` 中，并使用变量 `prevVnode` 来表示 `VNode` 是否已经挂载到 `container` 容器上。

* `prevVnode` 为 `null`，则调用 `mount` 方法进行初次挂载；

* 否则就调用 `patch` 方法对已经挂载的旧 `VNode` 进行更新。

```js
import { reactive, watchEffect } from '../core/reactive.js'
import { h, mount, patch } from '../core/render.js'

function mountApp(component, container) {
    let prevVnode = container.vnode
    watchEffect(() => {
        if (prevVnode == null) {
            // 挂载生成的 VNode
            prevVnode = container.vnode = component.render()
            mount(prevVnode, container)
        } else {
            // 更新 VNode
            const vnode = container.vnode = component.render()
            patch(prevVnode, vnode)
            prevVnode = vnode
        }
    })
}
```

这样，只需调用 `mountApp` 方法就实现了 `Model` 和 `View` 之间的响应性更新。

```js
const container = document.getElementById('app')
mountApp(App, container)
```

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/QWqWVPv)
:::

我们来简单分析一下响应性更新的过程。

* 调用 `mountApp` 后，会执行 `watchEffect` 中的 `effect` 方法。此时 `prevVnode` 为 `null`，调用 `mount` 方法挂载 `App` 对象返回的 `VNode`，同时创建 `VNode` 时由于引用了被监听对象会触发 `reactive` 的 `getter` 对依赖进行收集；

* 当 `click` 事件触发或使用 `App.data.msg = xxx` 直接修改 `msg` 取值时，会被 `reactive` 的 `setter` 拦截，执行其中的 `trigger` 再次调用 `effect` 方法。此时 `container` 上已有挂载节点，调用 `patch` 对旧节点进行更新。

上面是个非常简单的示例，我们再用渲染函数来更新列表。下面的示例中返回 `VNode` 包含多个带 `key` 值的子节点，当 `items` 取值改变时子节点都成功更新，且新增 `property` `color` 也能响应式更新。

```js
const App = {
    data: reactive({
        items: ['a', 'b', 'c']
    }),
    render() {
        return h('div', { class: this.data.color || 'red' },
            this.data.items.map((item, index) => h('div', { key: index }, item)))
    }
}

const container = document.getElementById('app')
mountApp(App, container)

App.data.items = ['hello', 'world']
App.data.color = 'green'
```

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/NWaWEBV)
:::