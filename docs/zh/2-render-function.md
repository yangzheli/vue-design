## VNode

在 `Vue` 中，我们可以使用**模板语法**来创建 `HTML`，也可以使用**渲染函数** `render` 来实现。

比如下面我们通过 `render` 来创建 `div` 元素，并向它添加点击事件。

```js
const { h, createApp } = Vue

const App = {
    data: function () {
        return {
            count: 0,
        }
    },
    render() {
        return h('div', { onclick: () => this.count++ }, this.count)
    },
}

createApp(App).mount('#app')
```

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/rNzKwPq)
:::

上一节我们实现了响应式，那么如何通过渲染函数生成 `DOM` 元素，将其挂载到指定位置，并在元素内容改变对其更新呢？

- 首先我们需要实现 `h` 函数，它返回的是一个虚拟节点 `VNode` (Virtual Node)；

- 其次需要实现 `mount` 函数，它将 `VNode` 挂载到指定容器 `container`；

- 再者实现 `patch` 函数，根据新旧 `VNode` 对 `container` 更新。

首先，我们需要考虑：为什么先创建 `VNode`，通过 `VNode` 来更新真实 `DOM`?

主要是因为除了浏览器端，我们还可能将元素渲染到其它平台，因此最终操作的不一定是 `DOM` 元素，比如 `Vue2` 提供了 `Weex` 相关的包，供开发者基于 `Weex` 来开发应用。因此，我们通过使用 `VNode` 来达到将渲染函数 `render` 与 `DOM` 之间**接耦**的目的，让渲染函数 `render` 不仅能渲染 `DOM` 元素，还能渲染其它平台的元素。我们将不同平台的编程接口进行封装，在需要时对这些接口进行替换，或者直接在初始化时将其作为参数传递，最终达到**跨平台**开发的目的。在之后的小节，我们将详细地对编程接口进行封装，而默认情况下，本文中渲染的都是 `DOM` 元素，即使用的是浏览器提供的 `DOM` 编程接口。

解释完 `VNode` 的作用，下面就让我们先来定义 `VNode` 的结构。

* `tag` 属性：当前 `VNode` 创建的 `DOM` 元素的 `HTML` 标签名；

* `props` 属性：创建元素的 `attribute` (包括事件)；

* `children` 属性：创建元素的子节点，为简化逻辑，我们规定 `children` 只能为字符串、数组或者 `null`，`null` 我们当为空数组处理，数组中元素类型可以为 `VNode` 或者字符串。

因此，`h` 函数的实现就非常简单，返回一个包含节点信息的对象，只有当 `children` 为数组且子元素为字符串时需特殊处理。

```js
function h(tag, props, children) {
    if (!children) children = []
    if (Array.isArray(children)) {
        for (let i = 0, len = children.length; i < len; i++) {
            if (typeof children[i] === 'string') children[i] = h(undefined, undefined, children[i])
        }
    }
    return { tag: tag, props: props, children: children }
}
```

这样，我们就可以用下面的 `VNode` 表示一个包含子节点的 `div` 元素。

```js
const vnode = h(
    'div', { class: 'red' }, [h('div', null, 'hello world')]
)
```

或者 (两者是等价的)：

```js
const vnode = h(
    'div', { class: 'red' }, [h('div', null, ['hello world'])]
)
```

## 挂载 mount

创建完 `VNode` 后，我们需要将其挂载到真实的 `DOM` 上。

* 首先根据 `tag` 属性创建真实 `DOM` 节点，并将该信息添加到 `VNode` 中。因此，向 `VNode` 添加 `el` 属性表示该 `VNode` 对应的真实 `DOM` 节点；

* 对于 `props` 属性，我们规定事件的键名为 `on` 加上首字母大写的事件名，如点击事件键名就是 `onClick`，其余非 `on` 开头的键名则为 `id` 之类的非事件 `attribute`；

* 对于 `children` 属性，如果类型为字符串，则该 `VNode` 为文本节点；否则该 `VNode` 包含子节点，我们递归对子 `VNode` 进行挂载，由于此时创建的真实 `DOM` 节点还可能为文本节点，因此需要额外进行判断，当 `tag` 为空时创建文本节点，否则创建元素节点；

* 最后只需将创建的 `DOM` 节点添加为容器的子节点。

```js
function mount(vnode, container) {
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
```

这样我们就成功通过 `mount` 方法将创建好的 `VNode` 挂载到指定容器上。

```js
const vnode = h(
    'div',
    {
        class: 'red',
        onClick: () => {
            alert('The div was clicked.')
        },
    },
    [h('div', null, 'hello world')]
)
const container = document.getElementById('app')

mount(vnode, container)
```

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/zYdaMgy)
:::

## 更新 patch

当元素内容改变生成新的 `VNode` 时，为什么不直接调用 `mount` 方法将该 `VNode` 更新到 `container` 中呢？

主要是因为此时 `container` 中已经包含旧的 `VNode` 中的内容，通过比较两个 `VNode` 显然要比比较 `VNode` 和 `DOM` 元素要简单。我们通过比较两个 `VNode` 对象，只需将其中的不同之处更新到 `container` 中即可。

因此，接下来我们就来实现 `patch` 方法，也就是我们常说的 **`diff`** 算法，对新、旧 `VNode` 进行比较并更新 `container`。

对于两个不同的 `VNode`，我们首先判断它们是否同为文本节点，对于文本节点只需更新真实 `DOM` 元素的 `textContent` 属性值；其次比较它们的标签名 `tag`，如果 `tag` 都不相同，显然就没有必要再对其进行比较，直接将旧 `VNode` 移除，新 `VNode` 添加进 `container` 即可。

当两者为相同的 `HTML` 元素，则需要比较其中的 `props` 和 `children`。

```js
function isUndef(s) { return s === undefined }

function patch(oldVnode, vnode) {
    if (vnode === oldVnode) return
    const el = (vnode.el = oldVnode.el)

    if (isUndef(oldVnode.tag) && isUndef(vnode.tag)) {  // 文本节点
        if (vnode.children !== oldVnode.children) el.textContent = vnode.children
    } else if (vnode.tag === oldVnode.tag) {
        // 对 props 和 children 进一步比较
    } else {
        const parent = el.parentNode
        parent.removeChild(el)
        mount(vnode, parent)
    }
}
```

对 `VNode` 的 `props` 更新比较简单，我们只需遍历所有新 `VNode` `props` 的键名，当该键名也存在于旧 `VNode` `props` 中，就对该 `attribute` 进行替换，不存在就新增，同时删除旧 `VNode` `props` 中多余的`attribute`。

```js{8-31}
function patch(oldVnode, vnode) {
    if (vnode === oldVnode) return
    const el = (vnode.el = oldVnode.el)

    if (isUndef(oldVnode.tag) && isUndef(vnode.tag)) {	// 文本节点
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
    } else {
        const parent = el.parentNode
        parent.removeChild(el)
        mount(vnode, parent)
    }
}
```

而对于 `VNode` 的子节点 `children` 进行更新则需要根据 `children` 的类型分情况讨论：

* 旧 `VNode` 子节点 `oldChildren` 为字符串，新 `VNode` 子节点 `newChildren` 也为字符串，两者都为文本节点，只需要替换真实 `DOM` 元素的 `textContent` 属性值即可；

* `oldChildren` 为字符串，`newChildren` 为数组，则需将文本内容清空，并将 `newChildren` 中的子节点依次挂载到当前 `DOM` 元素；

* `oldChildren` 为数组，`newChildren` 为字符串，仍然只需要替换 `textContent` 属性值即可；

* `oldChildren` 为数组，`newChildren` 也为数组，此时新、旧 `VNode` 都包含多个子节点，子节点中又可能嵌套着更多的节点。因此，这时实际上我们是对两颗新、旧**虚拟 `DOM` 树**进行比较，这也是 `diff` 算法最核心的部分 —— `updateChildren`。为了容易理解，这里我们先简单地将 `oldChildren` 中所有子节点移除，`newChildren` 中所有子节点添加进当前 `DOM` 元素，下一节我们将对 `updateChildren` 算法进一步的优化。

```js{33-53,61-68}
function patch(oldVnode, vnode) {
    if (vnode === oldVnode) return
    const el = (vnode.el = oldVnode.el)

    if (isUndef(oldVnode.tag) && isUndef(vnode.tag)) {	// 文本节点
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
    for (let i = 0, len = oldChildren.length; i < len; i++) {
        parent.removeChild(oldChildren[i].el)	// 移除子 VNode
    }
    for (let i = 0, len = newChildren.length; i < len; i++) {
        mount(newChildren[i], parent)	// 添加子 VNode
    }
}
```

这样我们就成功实现新、旧 `VNode` 的更新。

```js
const newVnode = h(
    'div',
    {
        class: 'green',
        onClick: () => {
            alert('Old eventListener was removed.')
        },
    },
    [h('div', null, 'hello world')]
)

// vnode 为前面挂载的节点
patch(vnode, newVnode)
```

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/NWvzQyM)
:::

## diff 算法核心

上一节的 `updateChildren` 算法对于子节点的更新显然不能满足我们的性能要求，它完全没有考虑节点复用的情况，需要频繁地删除、创建、添加 `DOM` 元素。实际上，新、旧 `VNode` 可能只是少数子元素改变。比如，下面例子中 `children` 只有一个子节点 `c` 更新为 `d`，如果将子节点全部删除，再重新创建、添加，无疑会造成不必要的性能消耗。

```js{5,12}
// oldChildren
[
    h('div', null, 'a'),
    h('div', null, 'b'),
    h('div', null, 'c')
]

// newChildren
[
    h('div', null, 'a'),
    h('div', null, 'b'),
    h('div', null, 'd')
]
```

因此，为减少性能开销，我们必须尽可能地对已有子节点进行复用。

在基于只有少数子节点改变的假设下，我们的一个想法就是根据索引比较两个子节点 —— 对公共索引部分递归调用 `patch` 方法，旧的子节点多余的就直接移除，新的子节点剩下的就直接添加。

```js
function updateChildren(parent, oldChildren, newChildren) {
    const oldLen = oldChildren.length
    const newLen = newChildren.length
    const commonLen = Math.min(oldLen, newLen)

    for (let i = 0; i < commonLen; i++) {
        patch(oldChildren[i], newChildren[i])
    }
    if (oldLen > commonLen) {
        for (let i = commonLen; i < oldLen; i++) {
            parent.removeChild(oldChildren[i].el)
        }
    }
    if (newLen > commonLen) {
        for (let i = commonLen; i < newLen; i++) {
            mount(oldChildren[i], parent)
        }
    }
}
```

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/Badgbgz)
:::

显然，从上述示例来看，这种思路是个不错的想法，子节点 `a b` 都得到了有效地复用。但是，在处理另外一些常见情况下，这种思路的性能将大大降低，比如当节点发生移动时。

我们只是单纯地将所有子节点向左移动，子节点顺序发生改变。

```js{3-5,10-12}
// oldChildren
[
    h('div', null, 'a'),
    h('div', null, 'b'),
    h('div', null, 'c')
]

// newChildren
[
    h('div', null, 'b'),
    h('div', null, 'c'),
    h('div', null, 'a')
]
```

如果我们还是调用上面的 `updateChildren` 方法，按照索引对子节点进行 `patch` 更新。

![diff-1.1](@alias/render/diff-1.1.png)

我们会发现，每个索引位置上的子节点都发生了改变，虽然示例中更新子节点只需要替换 `textContent`，但对于包含嵌套节点的子节点来说，毫无疑问大量子节点将被删除或者重新创建。因此，在应对节点移动、调换顺序这类问题上，根据索引比较子节点不是一个很好的方案。

实际上，通过观察我们可以看到，由于各个子节点之间顺序发生调换，只要将节点 `a` 移动到节点 `c` 之后就完成了更新。

![diff-1.2](@alias/render/diff-1.2.png)

### 最大索引值比较

为了对尽可能多的子节点进行复用，我们为节点添加一个唯一标识 `key`，当新、旧子节点中出现 `key` 值相同的两个节点，就说明我们可以对这个旧的子节点进行复用，以此达到通过**移动节点**，而非删除、创建节点来更新 `children` 的目的。

```js{3-5,10-12}
// oldChildren
[
    h('div', { key: 'a' }, 'a'),
    h('div', { key: 'b' }, 'b'),
    h('div', { key: 'c' }, 'c')
]

// newChildren
[
    h('div', { key: 'b' }, 'b'),
    h('div', { key: 'c' }, 'c'),
    h('div', { key: 'a' }, 'a')
]
```

实际上，我们在 `Vue` 中使用 `v-for` 循环时为列表添加 `key` 也是这个目的。 

```html
<ul id="app">
  <li v-for="item in items" :key="item.message">
    {{ item.message }}
  </li>
</ul>
```

这样，我们就对 `VNode` 结构相应调整，除了 `tag el props children` 四个属性外，我们额外增加 `key` 属性。

```js
function h(tag, props, children) {
    const key = props ? props.key : undefined
    if (!children) children = []
    if (Array.isArray(children)) {
        for (let i = 0, len = children.length; i < len; i++) {
            if (typeof children[i] === 'string') children[i] = h(undefined, undefined, children[i])
        }
    }
    return { tag: tag, props: props, children: children, key: key }
}
```

那么接下来只要遍历新、旧子节点，找到相同的 `key` 值的节点，就能到达节点复用的目的。

```js
function updateChildren(parent, oldChildren, newChildren) {
    const oldLen = oldChildren.length
    const newLen = newChildren.length

    for(let i = 0; i < newLen; i++) {
        for(let j = 0; j < oldLen; j++){
            if(newChildren[i].key === oldChildren[j].key) {
                patch(oldChildren[j], newChildren[i])
                // 移动节点
                break
            }
        }
    }
}
```

那么，再找到 `key` 值相同的节点后，应该如何对节点进行正确地移动呢？

为此，我们记录下 `newChildren` 中节点在 `oldChildren` 中的**索引**，通过比较索引值的大小来说明当前节点是否需要移动。

* 当 `newChildren` 中节点索引为**递增**排序，说明新旧子节点顺序相同，不需要移动。

比如，下图中子节点 `a b c` 顺序没有改变，索引顺序为 `0 -> 1 -> 2`，呈递增趋势，所以子节点都不需要移动。

![diff-2.1](@alias/render/diff-2.1.png)

* 当 `newChildren` 中节点索引为**非递增**排序，说明新旧子节点顺序不同，需要移动。

比如，下图中子节点 `a b c` 顺序发生改变，索引顺序为 `1 -> 2 -> 0`，其中子节点 `b c` 索引大小递增，说明这两个新、旧子节点顺序相同，不需要移动；而子节点 `a` 的索引小于 `c` 的索引，说明应该将节点 `a` 对应的 `DOM` 元素移动到节点 `c` 对应的 `DOM` 元素之后。

![diff-2.2](@alias/render/diff-2.2.png)

因此，我们在遍历 `children` 寻找 `key` 值相同的节点时，记录下 `key` 值相同节点在 `oldChildren` 中的**最大值索引 `lastIndex`**。将 `lastIndex` 初始值设为 `-1`，这样当前索引值为 `0` 时 `lastIndex` 值也能正确更新。

* 如果当前 `newChildren` 节点在 `oldChildren` 索引值大于**最大索引值**，说明新、旧子节点顺序没有改变，无需移动节点顺序，只需更新最大索引值即可；

* 否则新、旧子节点顺序发生改变，将当前节点对应的 `DOM` 元素移动到**上一个节点**对应的 `DOM` 元素之后。那么，为什么是将它移动到上一个节点而不是最大索引值节点对应的 `DOM` 元素之后呢？可以这样理解，我们从左向右遍历 `newChildren`，寻找 `key` 值相同的节点并移动 `DOM` 元素，当某一次节点移动完成后，该节点及其左边节点在 `newChildren` 中顺序和移动后的 `DOM` 元素顺序是一致的。

但是实际上我们还要考虑一种特殊情况，即子节点没有 `key` 值。我们一直在讨论的都是子节点有 `key` 值的情况下，由于 `key` 是唯一标识，在同一子节点中不会出现两个相同的 `key`。而子节点没有 `key` 值时，`newChildren` 的两个不同节点可能与 `oldChildren` 的同一个节点 `key` 值相同，因为它们 `key` 值都为 `undefined`。比如，下面示例中子节点 `b c a` 都匹配到 `oldChildren` 的第一个节点 `a`，它们都复用节点 `a` 显然会导致错误。

```js
// oldChildren
[
    h('div', null, 'a'),
    h('div', null, 'b'),
    h('div', null, 'c')
]

// newChildren
[
    h('div', null, 'b'),
    h('div', null, 'c'),
    h('div', null, 'a')
]
```

因此，为避免没有 `key` 值的节点复用同一个旧子节点，我们可以在 `h` 函数返回 `VNode` 时，根据子节点所在索引为没有 `key` 值的节点手动添加唯一 `key` 值；或者利用布尔值记录某个旧子节点是否已经被复用。

这里我们采用第二种方式，这样记录的布尔值在之后移除不存在的旧子节点也会用到。

```js{5-9,12-13,15-22}
function updateChildren(parent, oldChildren, newChildren) {
    const oldLen = oldChildren.length
    const newLen = newChildren.length

    let lastIndex = -1  // 最大索引值
    let oldIdxMap = []
    for (let i = 0; i < oldLen; i++) {
        oldIdxMap[i] = false   
    }
    for (let i = 0; i < newLen; i++) {
        for (let j = 0; j < oldLen; j++) {
            if (!oldIdxMap[j] && newChildren[i].key === oldChildren[j].key) {
                oldIdxMap[j] = true 
                patch(oldChildren[j], newChildren[i])
                if (j > lastIndex) {
                    // 更新最大索引值
                    lastIndex = j
                } else {
                    // 移动节点
                    const node = newChildren[i - 1].el.nextSibling
                    parent.insertBefore(newChildren[i].el, node)
                }
                break
            }
        }
    }
}
```

下面的示例也能清楚地说明为什么是移动到**上一个节点**对应的 `DOM` 元素之后。`newChildren` 中节点索引顺序为 `2 -> 1 -> 0`。

* 当遍历到节点 `b`，当前索引值 `1` 小于最大索引值 `2`，则将 `DOM` 元素 `b` 移动到 `DOM` 元素 `c` 之后；

* 当遍历到节点 `a`，当前索引值 `0` 小于最大索引值 `2`，则将 `DOM` 元素 `a` 移动到 `DOM` 元素 `b` 之后，而非最大索引值 `2` 对应的 `DOM` 元素 `c` 之后。

![diff-2.3](@alias/render/diff-2.3.png)

当然，不可能 `newChildren` 中的每个节点都能在 `oldChildren` 中找到 `key` 值相同的节点，因此，我们还需考虑两种情况就是 —— 添加新的节点以及移除不存在的节点。

* 如果 `oldChildren` 中查找不到当前相同 `key` 值的节点，则说明该节点是新添加的。我们用一个变量值 `find` 来说明 `oldChildren` 中是否存在相同 `key` 值的节点，当查找到时将该变量值设为 `true`，如果内层 `for` 循环结束 `find` 仍为 `false` 则表示该节点是新添加的。显然，该节点也是添加到**上一个节点**对应的 `DOM` 元素之后。当然，有一个特殊情况就是新添加的节点为 `newChildren` 的头节点，即该节点前面没有节点，那么我们就将这个新创建的 `DOM` 元素移动到 `children` 中所有 `DOM` 元素的前面。

```js{11,14,28-33}
function updateChildren(parent, oldChildren, newChildren) {
    const oldLen = oldChildren.length
    const newLen = newChildren.length

    let lastIndex = -1  // 最大索引值
    let oldIdxMap = []
    for (let i = 0; i < oldLen; i++) {
        oldIdxMap[i] = false   
    }
    for (let i = 0; i < newLen; i++) {
        let find = false
        for (let j = 0; j < oldLen; j++) {
            if (!oldIdxMap[j] && newChildren[i].key === oldChildren[j].key) {
                find = true
                oldIdxMap[j] = true 
                patch(oldChildren[j], newChildren[i])
                if (j > lastIndex) {
                    // 更新最大索引值
                    lastIndex = j
                } else {
                    // 移动节点
                    const node = newChildren[i - 1].el.nextSibling
                    parent.insertBefore(newChildren[i].el, node)
                }
                break
            }
        }
        if (!find) {
            // 添加新节点
            mount(newChildren[i], parent)
            const node = i > 0 ? newChildren[i - 1].el.nextSibling : oldChildren[0].el
            parent.insertBefore(newChildren[i].el, node)
        }
    }
}
```

比如，下图中节点 `d` 就是新添加的。

![diff-2.4](@alias/render/diff-2.4.png)

* 当遍历完 `newChildren`，`oldChildren` 中仍然没有被匹配到的节点就是需要被移除的。我们对 `oldChildren` 再进行一次遍历，利用之前记录的布尔值数组 `oldIdxMap` 将不存在于 `newChildren` 的节点移除。

```js{36-41}
function updateChildren(parent, oldChildren, newChildren) {
    const oldLen = oldChildren.length
    const newLen = newChildren.length

    let lastIndex = -1  // 最大索引值
    let oldIdxMap = []
    for (let i = 0; i < oldLen; i++) {
        oldIdxMap[i] = false   
    }
    for (let i = 0; i < newLen; i++) {
        let find = false
        for (let j = 0; j < oldLen; j++) {
            if (!oldIdxMap[j] && newChildren[i].key === oldChildren[j].key) {
                find = true
                oldIdxMap[j] = true 
                patch(oldChildren[j], newChildren[i])
                if (j > lastIndex) {
                    // 更新最大索引值
                    lastIndex = j
                } else {
                    // 移动节点
                    const node = newChildren[i - 1].el.nextSibling
                    parent.insertBefore(newChildren[i].el, node)
                }
                break
            }
        }
        if (!find) {
            // 添加新节点
            mount(newChildren[i], parent)
            const node = i > 0 ? newChildren[i - 1].el.nextSibling : oldChildren[0].el
            parent.insertBefore(newChildren[i].el, node)
        }
    }

    // 移除不存在的节点
    for (let i = 0; i < oldLen; i++) {
        if (!oldIdxMap[i]) {
            parent.removeChild(oldChildren[i].el)
        }
    }
}
```

比如，下图中节点 `d` 就是需要被移除的。

![diff-2.5](@alias/render/diff-2.5.png)

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/mdBdxqL)
:::

以上也是 `React` `diff` 算法的原理。

### 双端比较

在上一小节的 `updateChildren` 算法中，我们对 `newChildren` 从左到右进行遍历，并记录下其中节点在 `oldChildren` 中的索引，通过比较索引大小来移动节点。

这种方法确实充分地对子节点进行了复用，但是在某些情况下，算法中节点移动的次数可以进一步优化。

我们先来看下面这个示例 —— `oldChildren` 节点顺序为 `a b c`，`newChildren` 节点顺序为 `c a b`。采用**最大索引值比较**的话，需要先将 `DOM` 元素 `a` 移动到 `DOM` 元素 `c` 之后，再将 `DOM` 元素 `b` 移动到 `DOM` 元素 `a` 之后，共移动两次 `DOM` 元素。而通过观察我们可以看到，实际上只要将 `DOM` 元素 `c` 移动到 `DOM` 元素 `a` 之前，移动一次 `DOM` 元素就成功更新。

![diff-3.1](@alias/render/diff-3.1.png)

造成这种情况的主要原因就是**最大索引值比较**只是**单向遍历** `children`，因此，这一小节我们采用另外一种**双向遍历**的思路 —— **双端比较**，从新、旧子节点的左右两端开始比较。我们将指针分别指向新、旧子节点的头部和尾部。

* 首先比较 `children` 头节点 `newStartVnode` 与 `oldStartVnode` 的 `key` 值是否相同，相同则复用节点并将头部的两个指针指向下一个节点，否则进行下一次比较；

* 比较 `children` 尾节点 `newEndVnode` 与 `oldEndVnode` 的 `key` 值是否相同，相同则复用节点并将尾部的两个指针指向上一个节点，否则进行下一次比较；

* 比较 `newChildren` 头节点 `newStartVnode` 和 `oldChildren` 尾节点 `oldEndVnode` 的 `key` 值是否相同，相同则复用节点并更新指针指向，否则进行下一次比较；

* 比较 `newChildren` 尾节点 `newEndVnode` 和 `oldChildren` 头节点 `oldStartVnode` 的 `key` 值是否相同，相同则复用节点并更新指针指向。

![diff-3.2](@alias/render/diff-3.2.png)

同时，上述第 `1` 和 `2` 次比较中，由于节点位置没有改变，都是同时处于 `children` 头部或尾部，因此不需要移动 `DOM` 元素。而第 `3` 和 `4` 次比较中，节点位置发生改变，由 `children` 头部移动到尾部或者 `children` 尾部移动到头部，因此这时我们也需要移动对应的 `DOM` 元素。

* 当 `newStartVnode` 和 `oldEndVnode` `key` 值相同，则将 `oldEndVnode` 对应的 `DOM` 元素移动到当前 `children` 的最前面；

* 当 `newEndVnode` 和 `oldStartVnode` `key` 值相同，则将 `oldStartVnode` 对应的 `DOM` 元素移动到当前 `children` 的最后面。

```js
function updateChildren(parent, oldChildren, newChildren) {
    let oldStartIdx = 0
    let oldEndIdx = oldChildren.length - 1
    let newStartIdx = 0
    let newEndIdx = newChildren.length - 1 

    let oldStartVnode = oldChildren[0]
    let oldEndVnode = oldChildren[oldEndIdx]
    let newStartVnode = newChildren[0]
    let newEndVnode = newChildren[newEndIdx]

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
        if (oldStartVnode.key === newStartVnode.key) {
            patch(oldStartVnode, newStartVnode)
            oldStartVnode = oldChildren[++oldStartIdx]
            newStartVnode = newChildren[++newStartIdx]
        } else if (oldEndVnode.key === newEndVnode.key) {
            patch(oldEndVnode, newEndVnode)
            oldEndVnode = oldChildren[--oldEndIdx]
            newEndVnode = newChildren[--newEndIdx]
        } else if (oldEndVnode.key === newStartVnode.key) {
            patch(oldEndVnode, newStartVnode)
            // 移动节点
            parent.insertBefore(oldEndVnode.el, oldStartVnode.el)
            oldEndVnode = oldChildren[--oldEndIdx]
            newStartVnode = newChildren[++newStartIdx]
        } else if (oldStartVnode.key === newEndVnode.key) {
            patch(oldStartVnode, newEndVnode)
            // 移动节点
            parent.insertBefore(oldStartVnode.el, oldEndVnode.el.nextSibling)
            oldStartVnode = oldChildren[++oldStartIdx]
            newEndVnode = newChildren[--newEndIdx]
        } else {
            // 头部或尾部没有找到 key 相同的节点
        }
    }
}
```

我们就用上面的示例来说明一下**理想情况**下的比较过程，即总能通过四次头、尾部节点的比较找到相同 `key` 值的元素。

* 第一轮比较中，`newChildren` 尾节点 `newEndVnode` 与 `oldChildren` 头节点 `oldStartVnode` 的 `key` 值相同，将 `DOM` 元素 `a` 移动到 `a b d c` 的尾部，并将 `newEndIdx` 指针前移，`oldStartIdx` 指针后移；

![diff-3.3](@alias/render/diff-3.3.png)

* 第二轮比较中，`children` 头节点 `newStartVnode` 与 `oldStartVnode` 的 `key` 值相同，无需移动节点，只要将 `newStartIdx` 与 `oldStartIdx` 指针同时后移；

![diff-3.4](@alias/render/diff-3.4.png)

* 第三轮比较中，`newChildren` 头节点 `newStartVnode` 与 `oldChildren` 尾节点 `oldEndVnode` 的 `key` 值相同，将 `DOM` 元素 `c` 移动到 `d c` 的头部，并将 `newStartIdx` 指针后移，`oldEndIdx` 指针前移；

![diff-3.5](@alias/render/diff-3.5.png)

* 第四轮比较中，此时 `newChildren` 与 `oldChildren` 都只剩下一个节点 `d`，它们 `key` 值相同，无需移动节点，只要将 `newStartIdx` 与 `oldStartIdx` 指针同时后移。

![diff-3.6](@alias/render/diff-3.6.png)

此时，`oldStartIdx > oldEndIdx`，循环条件不满足，退出循环，双端比较结束。

但是显然，这只是理想情况，实际更新过程中肯定会出现四次比较后仍然没有出现匹配的情况。

比如下图中，四次比较都没能找到 `key` 值相同的元素。

![diff-3.7](@alias/render/diff-3.7.png)

对于这种非理想情况，我们应该如何处理呢？

和最开始查找相同 `key` 值节点的方式一样，我们遍历 `oldChildren`，从中找到与 `newStartVnode` `key` 值相同的节点。

* 如果找到该节点，则对该节点进行复用，将该节点对应的 `DOM` 元素移动到当前 `children` 的头部。同时，由于没有指针指向该节点，我们无法通过移动 `oldStartIdx` 或 `oldEndIdx` 来更新 `oldChildren` 剩余节点，因此我们将该节点置为 `null`，当 `oldStartIdx` 或 `oldEndIdx` 对应节点为 `null` 时直接向后或向前移动指针；

* 否则就说明 `newStartVnode` 为新添加的节点，我们创建新的 `DOM` 元素添加到当前 `children` 的头部。

这里我们使用对象存放 `oldChildren` 中 `key` 与索引之间的键值对便于多次查找，当然也可以使用 `findIndex` 等其它方法查找与 `newStartVnode` `key` 值相同的节点。

```js{1-7,10-13,23-34}
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
        // 省略
    } else if (oldEndVnode.key === newEndVnode.key) {
        // 省略
    } else if (oldEndVnode.key === newStartVnode.key) {
        // 省略
    } else if (oldStartVnode.key === newEndVnode.key) {
        // 省略
    } else {
        // 头部或尾部没有找到 key 相同的节点
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
```

另外，在**最大索引值比较**中，我们提到子节点没有 `key` 值的情况，因此我们也需要讨论当子节点没有 `key` 值**双端比较**能否正确更新，避免出现多次复用同一个旧子节点的情况。

* 当 `newChildren` 中没有 `key` 值的节点匹配到 `oldChildren` 头部或尾部没有 `key` 值的节点，节点复用后指针发生移动，因此不会出现该旧子节点被再次复用的情况；

* 当头部或尾部没有匹配到时，这个新子节点会被挂载并添加到当前 `children` 的头部。

显然，对于没有 `key` 值的子节点**双端比较**也能正确更新。当然和之前一样，当 `while` 循环结束时，`newChildren` 或 `oldChildren` 中可能还存在节点，这些节点是新添加的或者需要被移除的。

* 如果 `oldStartIdx > oldEndIdx`，`newChildren` 中可能仍存在需要添加的节点，这些节点索引在 `newStartIdx` 与 `newEndIdx` 之间。我们将其逐个挂载，由于剩余节点可能在初始 `newChildren` 的头部、中间也可能是尾部，那么应该这些新创建的节点添加到哪个位置呢？其实和之前**最大索引值比较**时插入到**上一个节点**对应的 `DOM` 元素之后一样，因为除了这些需要添加的节点，`newChildren` 中其它节点都已经更新成功，我们只需将这些节点对应的 `DOM` 元素插入到 **`newStartIdx` 上一个节点**对应的 `DOM` 元素之后、或者 **`newEndIdx` 下一个节点**对应的 `DOM` 元素之前即可，当然也需要考虑超出 `newChildren` 索引范围的边界情况；

* 如果 `newStartIdx > newEndIdx`，`oldChildren` 中可能仍存在需要移除的节点，这些节点索引在 `oldStartIdx` 与 `oldEndIdx` 之间。相比于添加新的节点，移除旧的节点就比较简单，我们只需使用 `removeChild` 方法将这些节点对应的 `DOM` 元素逐个移除即可。

```js
if (oldStartIdx > oldEndIdx) {
    // 添加新节点
    for (; newStartIdx <= newEndIdx; ++newStartIdx) {
        newStartVnode = newChildren[newStartIdx]
        mount(newStartVnode, parent)
        const node = newChildren[newEndIdx + 1] === null ? null : newChildren[newEndIdx + 1].el
        parent.insertBefore(newStartVnode.el, node)
    }
} else if (newStartIdx > newEndIdx) {
    // 移除不存在的节点
    for (; oldStartIdx <= oldEndIdx; ++oldStartIdx) {
        oldStartVnode = oldChildren[oldStartIdx]
        parent.removeChild(oldStartVnode.el)
    }
}
```

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/yLzLKLr)
:::

以上也是 `Snabbdom` 和 `Vue2` `diff` 的原理。

## DOM API 封装

在前面小节我们提到过，为实现**跨平台**，我们可以对不同平台的编程接口进行封装。由于我们渲染最多的就是 `DOM` 元素，因此这里以 `DOM` 编程接口封装为例说明如何封装相关的 `API`。

其实封装起来也比较简单，我们将 `createElement` 等需要用到的 `DOM` 方法全都封装进变量 `htmlDomApi` 中。

```js
function createElement(tagName, options) {
    return document.createElement(tagName, options)
}

function insertBefore(parentNode, newNode, referenceNode) {
    parentNode.insertBefore(newNode, referenceNode)
}

// 其它 DOM API

const htmlDomApi = {
    createElement,
    insertBefore,
    // 其它 DOM API
}
```

然后我们可以在初始化时将不同平台的编程接口 `domApi` 作为参数传入，默认情况下就是使用 `DOM` 编程接口 `htmlDomApi`。

```js
const api = domApi !== undefined ? domApi : htmlDomApi

// 创建元素
api.createElement(tag)
```