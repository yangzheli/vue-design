## Introduction

前面我们使用**渲染函数** `render` 实现了 `Model` 与 `View` 的响应式更新，而在 `Vue` 中还提供了基于 `HTML` 的**模板语法**，比如常见的 `Mustache` 语法、`v-bind` 指令等。

```html
<!-- Mustache -->
<span>Message: {{ msg }}</span>

<!-- v-bind -->
<div v-bind:id="id"></div>
```

实际上，这些模板语法最终也是被编译成了渲染函数。比如在 `Vue3`，我们使用 `Vue.compile` 来编译一个简单的模板字符串。

```html
<div>Hello world</div>
```

经过编译，返回的就是渲染函数。

```js
import { openBlock as _openBlock, createElementBlock as _createElementBlock } from "vue"

export function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (_openBlock(), _createElementBlock("div", null, "Hello world"))
}
```

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/ZEXYBOo)
:::

这个结果和我们之前使用 `h` 函数创建 `VNode` 基本类似。

```js
_createElementBlock("div", null, "Hello world")

h('div', null, 'hello world')
```

总而言之，模板语法让数据绑定更加简单、易于使用，而渲染函数更接近底层实现。

因此，我们对模板编译后返回 `VNode`，并对返回 `VNode` 进行挂载 `mount`、更新 `patch`。

## 抽象语法树 AST

为了将模板编译为 `VNode`，我们可以将其拆分为两步：

* 将模板解析为**抽象语法树** (Abstract Syntax Tree，AST)；

* 根据得到的 `AST` 返回渲染函数，通过渲染函数生成 `VNode`。 

那么很多人可能会疑惑，什么是 `AST` (抽象语法树)，为什么要先将模板解析为 `AST` 呢？

其实，除了模板解析，我们在很多其它地方都会用到 `AST`，比如现在非常主流的 `JavaScript` 库 `Babel`、`Eslint`，又或者其它编程语言的**解析器**。为了有更直观的感受，我们使用 [AST Explorer](https://astexplorer.net/) 来解析个例子试试，输入一个简单的 `HTML` 片段。

```html
<div>hello world</div>
```

这里使用的解析器为 `svelte`，最终解析而成的 `AST` 如下所示。当然使用的解析器不同，生成的 `AST` 也不尽相同。

```js
{
  "html": {
    "start": 0,
    "end": 22,
    "type": "Fragment",
    "children": [
      {
        "start": 0,
        "end": 22,
        "type": "Element",
        "name": "div",
...
```

看上去很复杂，实际上简单点说，**`AST` 就是一个包含输入节点信息、树形结构的对象**。我们的输入可以是 `HTML` 字符串，对应的解析器就是 `HTMLParser`，也可以是 `JavaScript` 字符串，对应的解析器就是 `JavaScript Parser`，或者其它需要解析、编译的内容。

将输入字符序列解析为 `AST` 一般可以分为两步：词法分析和语法分析。词法分析将输入识别为一个个单词 `token`，而语法分析会对其中的语法进行检查并生成语法树。通常这两步先后执行，但为加快解析效率可以交替进行。

回到本文的模板解析，我们将模板解析为 `AST` 实际上就是用对象的形式表示 `template` 中的节点信息、各节点间的层级关系，我们可以自定义 `AST` 的结构来保存这些信息。同时语法分析时，可以对 `template` 进行语法检查，比如标签是否闭合，并且根据不同的模板语法对其中的节点信息做不同的处理，将语法处理结果添加到 `AST` 的属性中。

那么，该如何将 `template` 解析为 `AST` 呢？

其实，解析 `template` 的思路也非常简单：循环解析直到整个 `template` 解析完成，遇到不同的字符或字符串就进行不同的语法处理。这里我们可以将 `template` 中字符串分为四种情况，并定义四个**钩子函数** `start end comment chars` 分别对这四种情况进行处理，将钩子函数作为参数 `handler` 传入，这样当模板语法改变时只需修改传入的钩子函数即可。

* 注释 `comment`，以 `<!--` 开头，`-->` 结尾；

* 结束标签 `end tag`，以 `</` 开头，`>` 结尾；

* 开始标签 `start tag`，以 `<` 开头，`>` 结尾；

* 其它 `chars`，包括换行符、空格以及文本 `text`。我们定义一个变量 `chars`，初值为 `true`，当匹配到整个注释、开始标签或者结束标签就将其置为 `false`，最后值如果仍为 `true` 就说明为其它字符或字符串。

```js
function parseHTML(html, handler) {
    while (html) {
        let chars = true
        if (html.indexOf('<!--') == 0) {    // comment

        } else if (html.indexOf('</') == 0) {   // end tag

        } else if (html.indexOf('<') == 0) {    // start tag

        } 
        
        // chars
        if (chars) {

        }
    }
}
```

对于注释 `comment`，只需找到其结尾 `-->`，对注释内容执行 `comment` 钩子函数即可。这里为简单起见我们直接忽略注释，即 `handler.comment` 为 `undefined`，当然你也可以将注释添加进 `AST` 的属性中。同时，为避免 `while` 陷入死循环，使用变量 `last` 存放上一个 `html` 值，确保正在向前解析 `template`。

```js{2-3,8-13,25-26}
function parseHTML(html, handler) {
    let index = 0
    let last = html

    while (html) {
        let chars = true
        if (html.indexOf('<!--') == 0) {    // comment
            index = html.indexOf('-->')
            if (index >= 0) {
                if (handler.comment) handler.comment(html.substring(4, index))
                html = html.substring(index + 3)
                chars = false
            }
        } else if (html.indexOf('</') == 0) {   // end tag

        } else if (html.indexOf('<') == 0) {    // start tag

        } 
        
        // chars
        if (chars) {

        }

        if (html == last) throw "Parse Error"
        last = html
    }
}
```

对于开始标签 `start tag`，我们先来分析标签内容的组成部分。

![ast-1.1](@alias/compile/ast-1.1.png)

从上图可以看到，对于 `div span` 这样的非空元素，标签内容包括标签名 `tagName`、属性 (包括事件) 部分 `rest`；而 `img input` 这样的空元素，由于它们是在开始标签中进行关闭，因此标签内容还额外包括空元素标志 `unary` 即 `/`。

因此，不包括起、止两个字符 `< >`，开始标签可以分为 `tagName rest unary` 三部分。而为了能够捕获到这三部分的内容，我们在正则表达式 `startTag` 中定义三个分组。

* `tagName` 部分包括字母和数字；

* `rest` 部分比较复杂，它由多个属性 `attribute` 构成，每个属性被 `=` 分为左右两部分。`=` 左边可能存在 `v-bind: v-on: : @` 等模板语法，所以除了字母、数字，还可能包括 `- : @` 这些字符；`=` 右边为属性值，属性值由成对的引号 `"" ''` 包裹，使用 `(?:"[^"]*")|(?:'[^']*')` 进行匹配；

* `unary` 部分则只需匹配 `/`。

因此，我们如下定义用于匹配整个开始标签的正则表达式 `startTag`。

```js
const startTag = /^<([A-Za-z0-9]+)((?:\s+[A-Za-z:@][-A-Za-z0-9:]*(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')))?)*)\s*(\/?)>/
```

这样整个开始标签 `tag` 和 `tagName rest unary` 三个分组内容都被我们捕获到，接着就定义内部函数 `parseStartTag` 接收这四个参数进一步处理。

```js{1,5,15-20,32-34}
const startTag = /^<([A-Za-z0-9]+)((?:\s+[A-Za-z:@][-A-Za-z0-9:]*(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')))?)*)\s*(\/?)>/

function parseHTML(html, handler) {
    let index = 0
    let match = null
    let last = html

    while (html) {
        let chars = true
        if (html.indexOf('<!--') == 0) {    // comment
            // 省略
        } else if (html.indexOf('</') == 0) {   // end tag

        } else if (html.indexOf('<') == 0) {    // start tag
            match = html.match(startTag)
            if (match) {
                html = html.substring(match[0].length)
                match[0].replace(startTag, parseStartTag)
                chars = false
            }
        } 
        
        // chars
        if (chars) {

        }

        if (html == last) throw "Parse Error"
        last = html
    }

    function parseStartTag(tag, tagName, rest, unary) {

    }
}
```

那么我们需要在 `parseStartTag` 函数中对这些参数做哪些处理呢？

首先出于代码健壮性考虑，由于使用空元素时可能没在末尾加标志 `/`，比如 `<img src="./ast.png">`，因此额外增加一次判断 —— 该标签名是否在所有空元素标签名中，确保区分出空元素和非空元素。

```js{1-2,8}
const empty = ['area', 'base', 'basefont', 'br', 'col', 'frame', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'embed', 'command', 'keygen', 'source', 'track', 'wbr']

function parseHTML(html, handler) {
    // 省略

    function parseStartTag(tag, tagName, rest, unary) {
        unary = empty.indexOf(tagName) > 0 || !!unary
    }
}
```

然后我们将 `rest` 中的多个属性用正则表达式 `attr` 拆分为单个，并解析出每个属性名及对应的值。再调用 `start` 钩子函数将解析得到的标签名 `tagName` 和属性创建为节点，用栈 `stack` 保存刚创建的节点。

* 对于空元素创建的节点，不需要将其入栈，因为它们是自闭合的，不可能包含子节点，相当于入栈后马上出栈；

* 而非空元素创建的节点，将其入栈，当遇到它的结束标签时就将其出栈，这样就保证栈顶节点就是将要入栈节点的父节点，因此通过入栈和出栈就知道了各节点间的层级关系。

最终，这些包含 `template` 信息的节点就构成了一颗语法树 `AST`。

就让我们先来定义 `AST` 节点的结构。

* `tag` 属性：节点的标签名 `tagName`；

* `attrs` 属性：数组，包含节点的多个属性名 `name`、属性值 `value`，同时由于属性中可能包含模板语法，因此额外添加 `dynamic` 属性表示该 `attribute` 是否包含模板语法。我们使用正则表达式 `onRE` 与 `bindRE` 分别检测属性名 `name` 中是否包含 `v-on: @` 或 `v-bind: :` 模板语法，包含则将 `dynamic` 设为 `true`，同时将其属性名前加上 `binding` 加以区分；

* `children` 属性：数组，包含节点的多个子节点；

* `hasBindings` 属性：布尔值，该节点的属性或者文本中是否包含模板语法 (不包括子节点)；

* `type` 属性：共 `2` 种类型，`type` 为 `1` 表示 `div img` 等元素节点，`2` 表示文本节点 (文本节点只有 `type` `text` 和 `hasBindings` 三个属性)，我们忽略注释故不考虑这一类型。

```js{5-7,9-30,37-61}
const empty = ['area', 'base', 'basefont', 'br', 'col', 'frame', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'embed', 'command', 'keygen', 'source', 'track', 'wbr']

const startTag = /^<([A-Za-z0-9]+)((?:\s+[A-Za-z:@][-A-Za-z0-9:]*(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')))?)*)\s*(\/?)>/
const attr = /([A-Za-z:@][-A-Za-z0-9:]*)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')))?/g
const onRE = /^(@|v-on:)(\w)/
const bindRE = /^(:|v-bind:)(\w)/

function parse(template) {
    let root = null
    let stack = []
    parseHTML(template, {
        start(tag, attrs, unary, hasBindings) {   // start tag
            let element = { tag, attrs, children: [], hasBindings, type: 1 }
            if (!root) root = element
            if (stack.length) {
                let parent = stack[stack.length - 1]
                parent.children.push(element)
            }
            if (!unary) stack.push(element)
        },
        end() { // end tag

        },
        chars() {   // chars

        }
    })
    return root
}

function parseHTML(html, handler) {
    // 省略

    function parseStartTag(tag, tagName, rest, unary) {
        unary = empty.indexOf(tagName) > 0 || !!unary
        if (handler.start) {
            let attrs = []
            let hasBindings = false
            rest.replace(attr, function (match, name, value) {
                let dynamic = false
                if (onRE.test(name)) {
                    dynamic = true
                    name = name.replace(onRE, function (all, prefix, letter) {
                        return 'binding' + letter.toUpperCase()
                    })
                } else if (bindRE.test(name)) {
                    dynamic = true
                    name = name.replace(bindRE, function (all, prefix, letter) {
                        return 'binding' + letter.toUpperCase()
                    })
                }
                hasBindings ||= dynamic
                attrs.push({
                    name: name,
                    value: value,
                    dynamic: dynamic
                })
            })
            handler.start(tagName, attrs, unary, hasBindings)
        }
    }
}
```

对于结束标签 `end tag`，我们同样定义正则表达式 `endTag` 来匹配整个结束标签。相比于开始标签，结束标签中内容非常简单，仅包含 `/` 和标签名 `tagName`，因此我们直接给出 `endTag` 定义。

```js
const endTag = /^<\/([A-Za-z0-9]+)>/
```

匹配到整个结束标签和标签名后，实际上我们只需调用 `end` 钩子函数将栈顶元素出栈即可。

```js{2,15,34-39,55-57}
const startTag = /^<([A-Za-z0-9]+)((?:\s+[A-Za-z:@][-A-Za-z0-9:]*(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')))?)*)\s*(\/?)>/
const endTag = /^<\/([A-Za-z0-9]+)>/
const attr = /([A-Za-z:@][-A-Za-z0-9:]*)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')))?/g
const onRE = /^(@|v-on:)(\w)/
const bindRE = /^(:|v-bind:)(\w)/

function parse(template) {
    let root = null
    let stack = []
    parseHTML(template, {
        start(tag, attrs, unary) {   // start tag
            // 省略
        },
        end() { // end tag
            stack.pop()
        },
        chars() {   // chars

        }
    })
    return root
}

function parseHTML(html, handler) {
    let index = 0
    let match = null
    let last = html

    while (html) {
        let chars = true
        if (html.indexOf('<!--') == 0) {    // comment
            // 省略
        } else if (html.indexOf('</') == 0) {   // end tag
            match = html.match(endTag)
            if (match) {
                html = html.substring(match[0].length)
                match[0].replace(endTag, parseEndTag)
                chars = false
            }
        } else if (html.indexOf('<') == 0) {    // start tag
            // 省略
        } 
        
        // chars
        if (chars) {

        }

        if (html == last) throw "Parse Error"
        last = html
    }

    // 省略

    function parseEndTag(tag, tagName) {
        if (handler.end) handler.end()
    }
}
```

匹配完注释、开始标签和结束标签后，变量 `chars` 仍为 `true`，则为换行符、空格或者文本。它们是注释、开始标签和结束标签之间的内容，即处于字符 `> <` 之间，因此我们查找下一个 `<` 字符即可找到其值，当然如果找不到 `<` 字符则说明剩余 `html` 全部为它们的内容。而在 `chars` 钩子函数中我们将解析得到的内容创建为文本节点，栈顶节点就是文本节点的父节点。

另外，为了过滤掉空格、换行符与空字符串，避免创建无实际意义的文本节点，使用 `trim` 方法对解析后的文本进行过滤。并且，文本中可能包含 `Mustache` 语法 —— 数据绑定最常见的形式，使用双大括号标识。

```html
<span>Message: {{ msg }}</span>
```

因此，我们使用正则表达式 `tagRE` 解析出其中内容。最终，将文本中的纯文本与 `Mustache` 语法拼接成表达式 `expression`，并利用三元表达式将其返回。

```js{2,15-33,56-59}
// 省略
const tagRE = /\{\{((?:.|\r?\n)+?)\}\}/g

function parse(template) {
    let root = null
    let stack = []
    parseHTML(template, {
        start(tag, attrs, unary) {   // start tag
            // 省略
        },
        end() { // end tag
            // 省略
        },
        chars(text) {   // chars
            if (text.trim()) {
                let tokens = []
                let lastIndex = 0
                let match, index
                let hasBindings = false
                while ((match = tagRE.exec(text))) {
                    hasBindings = true
                    index = match.index
                    if (index > lastIndex) {
                        const tokenValue = text.slice(lastIndex, index)
                        tokens.push(JSON.stringify(tokenValue))
                    }
                    tokens.push(match[1].trim())
                    lastIndex = index + match[0].length
                }
                const expression = tokens.join('+')
                let parent = stack[stack.length - 1]
                parent.children.push({ text: expression ? expression : text, type: 2, hasBindings })
            }
        }
    })
    return root
}

function parseHTML(html, handler) {
    let index = 0
    let match = null
    let last = html

    while (html) {
        let chars = true
        if (html.indexOf('<!--') == 0) {    // comment
            // 省略
        } else if (html.indexOf('</') == 0) {   // end tag
            // 省略
        } else if (html.indexOf('<') == 0) {    // start tag
            // 省略
        } 
        
        // chars
        if (chars) {
            index = html.indexOf('<')
            let text = index < 0 ? html : html.substring(0, index)
            html = index < 0 ? "" : html.substring(index)
            if (handler.chars) handler.chars(text)
        }

        if (html == last) throw "Parse Error"
        last = html
    }

    // 省略
}
```

这样就成功将模板解析为 `AST`，下面让我们用个示例来测试一下。

```html
<div id="app">
    <div :class="{ active: isActive }" class="static" @click="handleClick">
        <input type="text" name="input" value="hello world">
        <p>Message: {{ msg }}</p>
    </div>
</div>
```

```js
const template = document.getElementById('app').outerHTML
const ast = parse(template)
```

最终生成的 `AST` 如下所示。

```json
// AST
{
    "tag": "div",
    "attrs": [
        {
            "name": "id",
            "value": "app",
            "dynamic": false
        }
    ],
    "children": [
        {
            "tag": "div",
            "attrs": [
                {
                    "name": "bindingClass",
                    "value": "{ active: isActive }",
                    "dynamic": true
                },
                {
                    "name": "class",
                    "value": "static",
                    "dynamic": false
                },
// ...
```

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/OJxVrOd)
:::

我们就用简化的示例来分析一下栈更新和 `AST` 构建的过程。

```html
<div id="app">
    <img src="flower.png" alt="flower">
    <p>Message: {{ msg }}</p>
</div>
```

`AST` 构建过程如下所示，下图中步骤顺序与文字描述顺序一致 (图中 `AST` 的灰色节点为元素节点或文本节点，文本中的空格、换行符与空字符串被过滤)。

1. 初始时 `html` 为整个 `template`，栈 `stack` 为空，`AST` 根节点也为 `null`；

2. 解析到第一个元素 `div` 的开始标签，将其入栈，并作为树的根节点；

3. `div` 开始标签后是换行符和空格，`trim` 后为空被过滤；

4. 匹配到空元素 `img`，空元素并不需要入栈，将创建的元素节点作为栈顶节点 `div` 的子节点；

5. `img` 标签后也有换行符和空格，`trim` 后为空被过滤；

6. 匹配到非空元素 `p` 的开始标签，将其入栈，并创建元素节点作为 `div` 的子节点，此时栈顶节点变为 `p`；

7. `p` 开始标签后为文本，创建文本节点作为栈顶节点 `p` 的子节点；

8. 匹配到 `p` 的结束标签，将栈顶的节点 `p` 出栈；

9. `p` 结束标签后为换行符，`trim` 后为空被过滤；

10. 解析到根节点 `div` 的结束标签，将根节点出栈，此时 `html` 全部解析完成，`AST` 构建成功。

![ast-1.3](@alias/compile/ast-1.3.png)

## 返回渲染函数

`AST` 构建完成后，接下来我们就分两步将 `AST` 转化为渲染函数：

* 遍历整个 `AST`，将 `AST` 中节点、子节点信息拼接为目标**字符串 `code`**；

* 调用 `Function` 构造函数将 `code` 返回为渲染函数。

根据我们之前定义的 `AST` 节点结构，`AST` 中节点可以分为元素节点与文本节点。

* 元素节点包含属性和子节点，属性又可以分为静态属性和包含 `: @ v-if` 等模板语法的动态属性，而子节点显然就递归处理，因此生成 `code` 是一个递归的过程；

* 文本节点只包含文本，文本内容同样分为静态的纯文本和 `Mustache` 语法的表达式。

由于属性中的模板语法比较复杂，包括 `Class`、`Style`、事件等绑定，我们先只处理属性中的静态内容以及文本内容，之后再对其模板语法区分处理。另外，在渲染函数中我们生成 `VNode` 是使用 `h` 函数，因此我们这里也将使用它。

```js
// 子节点为文本节点
h('div', { id: 'app' }, 'hello world')

// 子节点为元素节点
h('div', { id: 'app' }, [
    h('div', null, 'hello world')
])
```

我们定义两个函数 `genElement`、`genText` 分别处理元素节点和文本节点，将节点的属性或文本拼接到字符串 `code` 上，最终生成的 `code` 就是 `h` 函数的形式。

```js
function genElement(node) {
    // attrs
    let props = ''
    if (node.attrs) {
        for (let i = 0, len = node.attrs.length; i < len; i++) {
            let attr = node.attrs[i]
            props += attr.name + ":'" + attr.value + "'"
            if (i < len - 1) props += ","
        }
    }

    // children
    let children = node.children.map(child => {
        if (child.type === 1) return genElement(child)
        else return genText(child)
    })

    // code
    return "h('" + node.tag + "'," + (props ? ("{" + props + "}") : null) + "," +
        (children && children.length ? ("[" + children + "]") : null) + ")"
}

function genText(node) {
    return node.hasBindings ? node.text : JSON.stringify(node.text)
}
```

再调用 `Function` 构造函数就能将 `code` 返回为渲染函数。

```js
function generate(ast) {
    const code = "with(this){return " + genElement(ast) + "}"
    return {
        code: code,
        render: new Function(code)
    }
}
```

这样我们就成功将 `AST` 转化为渲染函数，下面让我们用个示例来测试一下。

* 首先调用 `parse` 函数生成抽象语法树 `AST`；

* 再调用 `generate` 函数得到渲染函数 `render`；

* 执行渲染函数 `render` 生成 `VNode`，之后就可以对其进行挂载、更新。同样我们使用 `ES Module` 的方式引入 `h` 与 `mount` 函数，这里需要注意 `this` 的指向，在 `render` 匿名函数中 `this` 默认指向 `Window` 对象，而 `ES Module` 采用严格模式 `this` 默认为 `undefined`。因此，我们使用 `call` 方法来修改 `this` 的指向。

```js
import { h, mount } from '../core/render.js'

const template = `<div class="static">
                    <input type="text" name="input" value="hello world">
                    <p>Message: {{ msg }}</p>
                </div>`

const ast = parse(template)
const render = generate(ast).render

const vm = {
    msg: 'This is a message',
    h: h
}
const vnode = render.call(vm)

const container = document.getElementById('app')
mount(vnode, container)
```

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/JjrGOow)
:::

### v-bind

处理完属性中的静态内容以及文本内容，接下来我们对属性的模板语法进行处理。由于属性中的 `Class` `Style` 等语法并不相同，因此我们分别对其处理。

首先我们对元素节点的处理函数 `genElement` 略作调整，根据之前添加的 `dynamic` 属性区分处理属性的模板语法与非模板语法，并且将返回 `code` 中的 `h` 替换为 `_c`，我们定义函数 `createElement` (`code` 中简称 `_c`) 在生成 `VNode` 前对属性进行特殊处理。

```js{7-10,22-23,26-32}
function genElement(node) {
    // attrs
    let props = ''
    if (node.attrs) {
        for (let i = 0, len = node.attrs.length; i < len; i++) {
            let attr = node.attrs[i]
            let { name, value, dynamic } = attr

            if (dynamic) props += attr.name + ":" + attr.value
            else props += attr.name + ":'" + attr.value + "'"
            if (i < len - 1) props += ","
        }
    }

    // children
    let children = node.children.map(child => {
        if (child.type === 1) return genElement(child)
        else return genText(child)
    })

    // code
    return "_c('" + node.tag + "'," + (props ? ("{" + props + "}") : null) + "," +
        (children && children.length ? ("[" + children + "]") : null) + ")"
}

function createElement(tag, props, children) {
    if (props) {
        // handle
    }

    return h(tag, props, children)
}
```

和之前解析 `template` 一样，我们定义不同的钩子函数来处理属性的 `Class` `Style` 等语法，比如为处理 `Class`，我们在定义 `updateClass` 钩子函数，在 `createElement` 函数中调用即可，对于 `Style` 等其它属性也是一样。

```js{1-6,10-12}
let cbs = [
    function updateClass(props) {

    },
    // other hooks
]

function createElement(tag, props, children) {
    if (props) {
        for (let i = 0, len = cbs.length; i < len; i++) {
            cbs[i].call(this, props)
        }
    }

    return h(tag, props, children)
}
```

我们就以 `updateClass` 钩子函数为例进行说明。

首先我们来定义支持的 `Class` 绑定语法，我们规定 `Class` 的属性值可以是字符串、对象或者数组，数组中元素类型为字符串或者对象。

```html
<!-- String -->
<div :class="errorClass"></div>

<!-- Object -->
<div :class="{ active: isActive }"></div>

<!-- Array -->
<div :class="[{ active: isActive }, errorClass]"></div>
```

由于在解析 `template` 时已经将模板语法与非模板语法的属性名区分开 —— 模板语法 `Class` 属性名为 `bindingClass`，非模板语法为 `class`。因此，只需将 `bindingClass` 值处理后添加到 `class` 值中即可，我们定义内部函数 `stringifyClass` 对其进行解析，根据属性值类型可以分为三种情况。

* `Class` 的属性值为字符串，则直接返回该属性值；

* `Class` 的属性值为对象，则遍历该对象所有的键名，将值不为空的键名添加到返回结果中；

* `Class` 的属性值为数组，则递归对数组元素进行解析。

```js{1-3,7-33}
function concat(a, b) {
    return a ? b ? (a + ' ' + b) : a : (b || '')
}

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
```

这样就成功实现 `Class` 绑定，`Style` 绑定的实现方式也是类似。

```js
const template = `<div :class="[{ active: isActive }, errorClass]" class="static">
                    <input type="text" name="input" value="hello world">
                    <p>Message: {{ msg }}</p>
                </div>`

const ast = parse(template)
const render = generate(ast).render

const vm = {
    isActive: true,
    errorClass: 'error',
    msg: 'This is a message',
    _c: createElement,
}
const vnode = render.call(vm)

const container = document.getElementById('app')
mount(vnode, container)
```

:::tip Tip
[在 CodePen 上尝试](https://codepen.io/yangzheli/pen/gOGrENw)
:::

<!-- ### v-on 

### v-for  -->