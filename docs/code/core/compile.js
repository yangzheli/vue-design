import { isEmptyTag, isUndef, isDef, isHTMLTag } from './util.js'

const startTag = /^<([A-Za-z0-9]+)((?:\s+[A-Za-z:@][-A-Za-z0-9:]*(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')))?)*)\s*(\/?)>/
const endTag = /^<\/([A-Za-z0-9]+)>/
const attr = /([A-Za-z:@][-A-Za-z0-9:]*)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')))?/g
const onRE = /^(@|v-on:)(\w)/
const bindRE = /^(:|v-bind:)(\w)/
const tagRE = /\{\{((?:.|\r?\n)+?)\}\}/g

export function parse(template) {
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
            stack.pop()
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
            index = html.indexOf('-->')
            if (index >= 0) {
                if (handler.comment) handler.comment(html.substring(4, index))
                html = html.substring(index + 3)
                chars = false
            }
        } else if (html.indexOf('</') == 0) {   // end tag
            match = html.match(endTag)
            if (match) {
                html = html.substring(match[0].length)
                match[0].replace(endTag, parseEndTag)
                chars = false
            }
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
            index = html.indexOf('<')
            let text = index < 0 ? html : html.substring(0, index)
            html = index < 0 ? "" : html.substring(index)
            if (handler.chars) handler.chars(text)
        }

        if (html == last) throw "Parse Error"
        last = html
    }

    function parseStartTag(tag, tagName, rest, unary) {
        unary = isEmptyTag(tagName) || !!unary
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

    function parseEndTag(tag, tagName) {
        if (handler.end) handler.end();
    }
}

export function generate(ast, options) {
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

// optimize
function optimize(root) {
    if (!root) return
    markStatic(root)
    markStaticRoot(root)
}

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

function genElement(node, staticRenderFns) {
    // 静态根节点
    if (node.staticRoot && !node.staticProcessed) {
        node.staticProcessed = true
        staticRenderFns.push(("with(this){return " + genElement(node, staticRenderFns) + "}"))
        return "_r(" + (staticRenderFns.length - 1) + ")"
    }

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
        if (child.type === 1) return genElement(child, staticRenderFns)
        else return genText(child)
    })

    // code
    return "_c('" + node.tag + "'," + (props ? ("{" + props + "}") : null) + "," +
        (children && children.length ? ("[" + children + "]") : null) + ")"
}

function genText(node) {
    return node.hasBindings ? node.text : JSON.stringify(node.text)
}