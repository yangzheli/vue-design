## 响应性原理

当 `Model` 中数据发生变化时，每次都手动更新 `View` 显然太繁琐，数据响应式更新无疑能节省不少工作。

为了简化这个问题，我们首先来分析一下如何实现变量之间的响应性。下面是个简单的示例：

```js
let price = 10
let quantity = 4
let sales = price * quantity

console.log(sales) // 40

price = 20

console.log(sales) // 40
```

在变量 `price` 值改变后，`sales` 的值并没有随之改变。为了实现 `sales` 响应式更新，我们定义如下三个方法：

- `effect`：依赖 - 需要重新执行的代码；

- `track`：对依赖进行收集；

- `trigger`：执行所有 `effect` 方法。

```js
let dep = new Set()

let effect = () => { sales = price * quantity }

function track() { dep.add(effect) }

function trigger() { dep.forEach(effect => effect()) }
```

开始时，我们**手动调用** `track` 方法收集所有依赖，将其放入一个 `Set` 集合中，并在 `price` 值改变后**手动调用** `trigger` 方法，就能实现 `sales` 响应式更新了。

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/eYErByR)
:::

:::tip Reference
以上示例参考 [Vue 3 Reactivity](https://www.vuemastery.com/courses/vue-3-reactivity/)
:::

实际上，这类似于 `React` 的 `setState` 方法：

```js
const setState = newState => {
    state = newState
    // 对视图进行相应的更新
    update()
}
```

为了实现在修改变量值 `state.a = x` 后，`trigger` 方法**自动调用**，我们使用 `getter/setter` 对属性值进行代理。

## getter/setter

在 `Vue2` 中，采用的是 `Object.defineProperty()` 来实现，虽然这种方式有一些缺点，比如无法检测对象 `property` 的新增或删除，但我们还是先使用这种方式来对上面的代码进行改进，之后再进一步优化。

我们将变量 `price` 和 `quantity` 作为监听对象的 `property` 并将它们转化为 `getter/setter`，这样就能在它们被访问或者修改时得到通知：在被访问时调用 `track` 方法，在被修改时调用 `trigger` 方法。

```js{12,18}
let product = {
    price: 10,
    quantity: 4
}

function reactive(target) {
    Object.keys(target).forEach(key => {
        let value = target[key]

        Object.defineProperty(target, key, {
            get() {
                track(target, key)
                return value
            },
            set(newValue) {
                if(newValue === value) return
                value = newValue
                trigger(target, key)
            },
        })
    })
}

reactive(product)
```

显然，`track` 和 `trigger` 方法相应地也要修改。我们使用 `depsMap` 来保存 `target` 对象中 `property` 的依赖关系，同时可能存在不同的 `target` 对象需要监听，因此再使用 `targetMap` 来保存 `target` 对象的依赖关系。

```js
const targetMap = new Map()

function track(target, key) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
        depsMap.set(key, (dep = new Set()))
    }
    dep.add(effect)
}

function trigger(target, key) {
    const depsMap = targetMap.get(target)
    if (!depsMap) return
    const dep = depsMap.get(key)
    if (dep) {
        dep.forEach(effect => {
            effect()
        })
    }
}
```

这样在修改属性值 `product.price = 20` 后，变量 `sales` 的值也能响应式更新了。

但是，执行上述代码后我们会发现有一个问题：当监听变量值改变时会再次触发 `track` 方法，又一次试图监听已经存在的对象。因此，我们引入 `activeEffect` 变量，来避免 `track` 方法不必要的触发。

```js
let activeEffect = null

function watchEffect(effect) {
    activeEffect = effect
    effect()
    activeEffect = null
}

watchEffect(() => {
    sales = product.price * product.quantity
})
```

同时修改 `track` 方法通过 `activeEffect` 值判断。

```js
function track(target, key) {
    if (activeEffect) {
        let depsMap = targetMap.get(target)
        if (!depsMap) {
            targetMap.set(target, (depsMap = new Map()))
        }
        let dep = depsMap.get(key)
        if (!dep) {
            depsMap.set(key, (dep = new Set()))
        }
        dep.add(activeEffect)
    }
}
```

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/WNEJzpj)
:::

但是，前面也提到过，使用 `Object.defineProperty()` 来跟踪变化是有缺陷的。

* 无法检测对象 `property` 的新增或删除；

```js
// 都不会触发上述 reactive 方法的 getter/setter
product.salePrice = 15

delete product.price
```

* 无法检测数组的变动：当直接修改数组的长度时，无法触发 `reactive` 方法的 `setter`。

```js
let items = [10, 20, 30]

reactive(items)

watchEffect(() => {
    sales = items[1] * product.quantity
})

items.length = 1 // 不是响应性的
```

为了解决上述问题，`Vue2` 提供了 `vm.$set` 实例方法，但这种方式显然不够优雅。而在 `Vue3` 中，则是采用了 `Proxy` 更好地解决了这一问题。

## Proxy

`Proxy` 能够返回一个代理对象，同时可以通过 `handler` 实现对基本操作的拦截和修改，可以在 `handler` 中定义 `get()` 和 `set()` 来捕获属性读取和修改操作。

另外，`Reflect` 常常配合 `Proxy` 一起使用，可以用来代替操作符完成对象的拦截和修改，比如 `Reflect.set()` 可以替代 `=` 赋值运算符。

下面我们就使用 `Proxy` 和 `Reflect` 来对上一小节的 `reactive` 方法进行改进，同时将 `product` 作为返回的代理对象而非目标对象。

```js
function reactive(target) {
    const handler = {
        get(target, key, receiver){
            let result = Reflect.get(target, key, receiver)
            track(target, key)
            return result
        },
        set(target, key, value, receiver){
            let oldValue = target[key]
            let result = Reflect.set(target, key, value, receiver)
            if(oldValue !== value){
                trigger(target, key)
            }
            return result
        }
    }
    return new Proxy(target, handler)
}

let product = reactive({
    price: 10,
    quantity: 4,
})
```

这样也实现了变量 `sales` 的响应式更新。

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/QWMrxWe)
:::

同时我们来测试一下 `Proxy` 是否检测到对象 `property` 的新增或删除以及数组的变动。

* 对象 `property` 新增；

```js
product.salePrice = 15  // 触发 handler 的 setter
```

* 为了检测对象 `property` 的删除，只需要在 `handler` 中定义 `deleteProperty()` 捕获器即可；

```js
const handler = {
    deleteProperty(target, key){
        // ...
    }
}

delete product.price    // 触发 handler 的 deleteProperty
```

* 数组长度的变动。

```js
let items = reactive([10, 20, 30])

items.length = 1    // 触发 handler 的 setter，捕获到的 key 为 length
```

这样，我们就用 `Proxy` 完美地解决了使用 `Object.defineProperty()` 跟踪对象变化时存在的一些问题。

自此，我们就实现了变量间的响应式更新。对于 `Model` 和 `View` 之间的响应性更新实际上也同样如此，只不过更新对象变为 `DOM` 元素而已。

<!-- ## 计算属性

在我们使用 `Vue` 时，处理一些复杂逻辑非常优雅的方法就是使用计算属性。

```js
const salePrice = computed(() => {
    return product.price * 0.8
})
```

使用计算属性能够帮助我们处理一些复杂的绑定逻辑。计算属性能够返回一个不可变的响应式对象，那么我们如何实现呢？ -->