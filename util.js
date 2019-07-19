function once(f) {
    let done = false
    return function() {
        if (done) return
        done = true
        return f.apply(this, arguments)
    }
}

function dynamicSelector(target, selector, handler) {
    let cancel = undefined
    let done = false
    // 记录 record 去重复是为了处理这样一个场景:
    // 先添加了一个符合条件的节点, 紧接着又往该节点种插入了符合条件的子节点, 
    // 这样会产生两次事件. 由于异步, 在第一个事件被处理时, 已经可以访问到子节点了,
    // 于是处理第二个事件时就需要避免重复处理.
    let record = new WeakSet()
    let f = (el) => {
        if (done || record.has(el)) {
            return
        }
        record.add(el)
        handler(el, cancel)
    }

    let config = {
        childList: true,
        subtree: true
    }
    let callback = (mutations) => {
        for (let m of mutations) {
            for (let n of m.addedNodes) {
                if (n.nodeType !== Node.ELEMENT_NODE) {
                    continue
                }
                if (n.matches(selector)) {
                    f(n)
                }
                for (let el of n.querySelectorAll(selector)) {
                    f(el)
                }
            }
        }
    }
    let observer = new MutationObserver(callback)
    observer.observe(target, config)
    cancel = () => {
        done = true
        observer.disconnect()
    }

    target.querySelectorAll(selector).forEach(f)

    return cancel
}

function dynamicSelectorOnce(target, selector, handler) {
    return dynamicSelector(target, selector, (el, cancel) => {
        cancel()
        handler(el)
    })
}

function download(url, name) {
    let a = document.createElement('a')
    document.body.appendChild(a)
    a.style = 'display: none'
    a.href = url
    a.download = name || 'unknow'
    a.click()
    a.remove()
}

function onDOMReady(f) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', f)
    } else {
        f()
    }
}

function onclick(target, num, f) {
    let timer = undefined
    let clicks = 0
    target.addEventListener('click', event => {
        if (!timer) {
            clicks = 1
            timer = setTimeout(() => {
                timer = undefined
                if (clicks === num) {
                    f(event)
                }
                clicks = 0
            }, 500)
        } else {
            clicks++
        }
    })
}

const ajax = {
    get: function(url, cfg) {
        cfg = cfg || {}

        function newResponse(xhr) {
            let resp = {}
            resp.status = xhr.status
            resp.statusText = xhr.statusText
            resp.data = xhr.responseText
            let contentType = xhr.getResponseHeader('Content-Type')
            if (contentType && contentType.indexOf('json') > -1) {
                resp.data = JSON.parse(xhr.responseText)
            }
            return resp
        }
        return new Promise(function(resolve, reject) {
            let xhr = new XMLHttpRequest()
            if (cfg.params) {
                let u = new URL(url)
                for (let key in cfg.params) {
                    u.searchParams.set(key, cfg.params[key])
                }
                url = u.href
            }
            if (cfg.headers) {
                for (let key in cfg.headers) {
                    xhr.setRequestHeader(key, cfg.headers[key])
                }
            }
            if (cfg.timeout) {
                xhr.timeout = cfg.timeout
                xhr.ontimeout = function() {
                    reject("xhr timeout", this)
                }
            }
            xhr.open("GET", url, true)
            xhr.onload = function() {
                if (this.readyState === this.DONE) {
                    let resp = undefined
                    try {
                        resp = newResponse(this)
                    } catch (e) {
                        reject(e, this)
                        return
                    }
                    if (this.status >= 200 && this.status < 300) {
                        resolve(resp, this)
                    } else {
                        reject(resp, this)
                    }
                }
            }
            xhr.onerror = function() {
                reject("xhr error", this)
            }
            xhr.send()
        })
    }
}

function addStyle(css) {
    let style = document.createElement('style')
    style.innerHTML = css
    document.head.appendChild(style)
    return style
}

function replaceDom(html) {
    document.open()
    if (html) {
        document.write(html)
    }
    document.close()
}

function onURLChanged(handler) {
    let done = false
    let preURL = window.location.href
    let f = (event) => {
        if (done) {
            return
        }
        let currentURL = window.location.href
        if (preURL !== currentURL) {
            preURL = currentURL
            handler(currentURL, event)
        }
    }

    // 改变 url 而不刷新页面主要有 2 类方法
    // 1. 改变 hash, 类似于 http://www.example.com/#/path
    // 2. 通过 history 的 pushState, popState, replaceState 方法

    function h1(e) {
        f('hashchange')
    }
    window.addEventListener('hashchange', h1)

    function h2(e) {
        f('popstate')
    }
    window.addEventListener('popstate', h2)

    let pushState = window.history.pushState

    function h3() {
        pushState.apply(this, arguments)
        f('pushstate')
    }
    window.history.pushState = h3

    let replaceState = window.history.replaceState

    function h4() {
        replaceState.apply(this, arguments)
        f('replacestate')
    }
    window.history.replaceState = h4

    // cancel
    return () => {
        done = true
        window.removeEventListener('hashchange', h1)
        window.removeEventListener('popstate', h2)
        if (window.history.pushState == h3) {
            window.history.pushState = pushState
        }
        if (window.history.replaceState == h4) {
            window.history.replaceState = replaceState
        }
    }
}
