<script setup lang="ts">
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { navigateToInterceptor } from '@/router/interceptor'
import { useTokenStore } from '@/store'

const tokenStore = useTokenStore()

onLaunch((options) => {
  console.log('App.vue onLaunch', options)
  void tokenStore.bootstrap()
})

onShow((options) => {
  console.log('App.vue onShow', options)
  void tokenStore.bootstrap()
  if (options?.path) {
    navigateToInterceptor.invoke({ url: `/${options.path}`, query: options.query })
  }
  else {
    navigateToInterceptor.invoke({ url: '/' })
  }
})

onHide(() => {
  console.log('App Hide')
})
</script>
