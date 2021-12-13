成功实现 `Model` 和 `View` 的响应性更新后，接下来我们来考虑对更新过程进一步优化！

## 静态根节点标记

在使用模板语法更新 `View` 的时候，我们会调用 `createElement` 函数生成新的 `VNode`，再对新、旧 `VNode` 进行 `patch` 更新。而实际上，模板中并不是所有内容都需要更新，即很多内容在首次渲染后就不会再变化。比如下面示例中 `Class` 属性值为 `static` 的 `div` 就是静态的，它的内容及所有子节点内容都不会改变；而另一个 `div` 则是非静态的，其中包含模板语法。

```html
<div class="static">
    <p>hello world</p>
</div>
<div :class="{ active: isActive }">
    <p>Message: {{ msg }}</p>
</div>
```

因此为对其进行优化，避免重新渲染 `template` 中的静态内容，我们分以下几步实现：

* 首先在 `template` 被解析为 `AST` 后，向 `AST` 中添加额外标记，将那些内容不会改变的节点标记为**静态节点**，静态节点中部分为**静态根节点**；

* 通过 `AST` 返回渲染函数时，也需要对其中的静态根节点返回新的渲染函数；

* 在静态根节点的渲染函数中，首次渲染时我们创建新的 `VNode` 并使用数组将其保存，更新后只需根据索引返回数组中存储的 `VNode` 即可。这样在 `patch` 更新时，由于新、旧 `VNode` 为同一对象直接返回，实现优化。

那么就先对 `AST` 中的静态节点与静态根节点进行标记，我们对 `compile` 模块的代码略作调整，在 `generate` 方法生成目标字符串 `code` 之前，先调用 `markStatic` `markStaticRoot` 方法分别标记出 `AST` 中的静态节点、静态根节点。添加额外的参数 `options` 表示是否执行此优化。

```js{1-4,12-16}
function generate(ast, options) {
    if (!(options && options.optimize === false)) {
        optimize(ast)
    }
    const code = "with(this){return " + genElement(ast) + "}"
    return {
        code: code,
        render: new Function(code)
    }
}

function optimize(root) {
    if (!root) return
    markStatic(root)    // 标记 AST 中的静态节点
    markStaticRoot(root)    // 标记 AST 中的静态根节点
}
```

首先使用 `static` 属性来标记 `AST` 中的静态节点，满足以下两个条件的节点将被标记为静态节点：

* 该节点不是组件，节点的属性或文本中不包含模板语法，即 `hasBindings` 属性为 `false`；

* 如果包含子节点，则所有子节点都必须是静态节点。

```js
function markStatic(node) {
    node.static = !node.hasBindings && (isUndef(node.tag) || isHTMLTag(node.tag))
    if (node.type === 1) {
        for (let i = 0, len = node.children.length; i < len; i++) {
            let child = node.children[i]
            markStatic(child)
            if (!child.static) node.static = false
        }
    }
}
```

之后，使用 `staticRoot` 属性将满足下列条件的静态节点标记为静态根节点。

* 该节点为元素节点，忽略文本节点是因为当父元素节点被数组存储时它也被包含其中，缓存单独的静态文本节点反而浪费开销；

* 至少包含一个子节点，如果仅有一个子节点则该子节点不为文本节点，否则将该节点标记为静态根节点还不如直接创建、返回新节点。

```js
function markStaticRoot(node) {
    if (node.type === 1) {
        if (node.static && node.children.length && !(node.children.length === 1 && node.children[0].type === 2)) {
            node.staticRoot = true
            return
        } else {
            node.staticRoot = false
        }
        for (let i = 0, len = node.children.length; i < len; i++) {
            markStaticRoot(node.children[i])
        }
    }
}
```

接下来我们为静态根节点返回不同的渲染函数，之前我们在渲染函数中使用 `createElement` 方法生成 `VNode`，对于静态根节点，我们定义新的函数 `renderStatic` (`code` 中简称 `_r`)进行处理。并且定义数组 `staticRenderFns` 将静态根节点的渲染函数存储起来，在之后调用函数 `renderStatic` 时参数 `index` 就是该静态根节点生成的渲染函数在数组 `staticRenderFns` 中的索引。

```js{5-7,11,15-21,27,36-38}
function generate(ast, options) {
    if (!(options && options.optimize === false)) {
        optimize(ast)
    }
    let staticRenderFns = []
    const code = "with(this){return " + genElement(ast, staticRenderFns) + "}"
    staticRenderFns = staticRenderFns.map(code => new Function(code))
    return {
        code: code,
        render: new Function(code),
        staticRenderFns
    }
}

function genElement(node, staticRenderFns) {
    // 静态根节点
    if (node.staticRoot && !node.staticProcessed) {
        node.staticProcessed = true
        staticRenderFns.push(("with(this){return " + genElement(node, staticRenderFns) + "}"))
        return "_r(" + (staticRenderFns.length - 1) + ")"
    }

    // 省略

    // children
    let children = node.children.map(child => {
        if (child.type === 1) return genElement(child, staticRenderFns)
        else return genText(child)
    })

    // code
    return "_c('" + node.tag + "'," + (props ? ("{" + props + "}") : null) + "," +
        (children && children.length ? ("[" + children + "]") : null) + ")"
} 

function renderStatic(index) {
    // render static
}
```

在静态根节点的渲染函数 `renderStatic` 中，我们使用数组 `_staticVnodes` 存储静态根节点返回的 `VNode`。如果在数组找不到该索引对应的 `VNode` 则为初次渲染，我们创建新的 `VNode` 存储到数组中；否则就直接返回数组中之前创建的 `VNode`。

```js
function renderStatic(index) {
    let cached = this._staticVnodes || (this._staticVnodes = [])
    let vnode = cached[index]
    if (vnode) return vnode
    vnode = cached[index] = this.staticRenderFns[index].call(this)
    return vnode
}
```

下面我们就用示例来测试一下，我们定义如下的 `template`。

```js
const template = `<div>
                    <div class="static">
                        <p>hello world</p>
                    </div>
                    <div :class="{ active: isActive }">
                        <p>Message: {{ msg }}</p>
                    </div>
                </div>`
```

由于之前已经分析过响应性更新的过程，这里我们只分析优化前、后不同的部分。

* 可以看到，在 `template` 中包含一个 `Class` 属性值为 `static` 的静态根节点，调用 `optimize` 方法后，`AST` 中该节点的  `staticRoot` 属性为 `true`；

```json
// 部分 AST
{
    "tag": "div",
    "attrs": [
        {
            "name": "class",
            "value": "static",
            "dynamic": false
        }
    ],
    // ...
    "static": true,
    "staticRoot": true
}
```

* 之后将 `AST` 生成 `code` 时，该静态根节点返回的 `code` 被替换为 `_r(0)`，而优化前返回的 `code` 被存储到数组 `staticRenderFns` 中。

```js
// 该静态根节点返回的 code 
_r(0)

// staticRenderFns
["with(this){return _c('div',{class:'static'},[_c('p',null,["hello world"])])}"]
```

* 在初次调用渲染函数 `render` 进行挂载时，数组 `_staticVnodes` 为空，我们调用数组 `staticRenderFns` 中的渲染函数创建新的 `VNode` ，并存储存储到 `_staticVnodes` 中；

* 再次调用 `render` 进行更新时，在数组 `_staticVnodes` 中找到该索引对应的 `VNode` 直接返回，这样 `patch` 时新、旧 `VNode` 为同一对象触发 `if` 避免了后续的比较，达到优化的目的。

```js
function patch(oldVnode, vnode) {
    if (vnode === oldVnode) return
    
    // 省略
}
```

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/ExwgjvK)
:::

<!-- ## 异步渲染

到目前为止，我们都是采用同步渲染的方法，即每次在数据变化后，立即同步更新 `View`。因此，在之前的示例中我们先后两次改变 `Model` 中的数据，也将触发两次 `patch` 更新。

```js
App.data.msg = 'A new message'
App.data.isActive = false
```

而实际上，只进行第二次 `patch` 就能完成 `View` 的更新，同步渲染的方式无疑会造成不必要的性能消耗。因此，我们需要将多次更新进行合并，采用异步的方式更新 `View`，避免不必要的计算和 `DOM` 更新。

那么我们该如何实现异步渲染呢？哪些情况下需要将更新进行合并呢？



原理：将页面变化的部分放入异步函数的回调中，直到同步代码执行完之后，执行回调，这样同步代码中所有变化被合并起来，最终执行一次 patch 更新。


在 Vue 和 React 中对于 -->