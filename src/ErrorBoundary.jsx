import { Component } from 'react'

class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? <p>组件出错了！</p> : this.props.children
  }
}

export default ErrorBoundary