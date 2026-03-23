import type { Component } from 'vue'

declare module '*?async' {
  const component: Component
  export = component
}
