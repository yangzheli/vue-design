const targetMap = new Map()
let activeEffect = null

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

function trigger(target, key) {
    const depsMap = targetMap.get(target)
    if (!depsMap) return
    const dep = depsMap.get(key)
    if (dep) {
        dep.forEach(effect => {
            effect()
            // if (effect.scheduler) {
            //     effect.scheduler()
            // } else {
            //     effect()
            // }
        })
    }
}

export function reactive(target) {
    const handler = {
        get(target, key, receiver) {
            let result = Reflect.get(target, key, receiver)
            track(target, key)
            return result
        },
        set(target, key, value, receiver) {
            let oldValue = target[key]
            let result = Reflect.set(target, key, value, receiver)
            if (oldValue !== value) {
                trigger(target, key)
            }
            return result
        },
    }
    return new Proxy(target, handler)
}

export function watchEffect(effect) {
    activeEffect = effect
    effect()
    activeEffect = null
}