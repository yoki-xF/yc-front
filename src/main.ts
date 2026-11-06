import { createApp } from 'vue'
import { Button, Field, Form, Cell, CellGroup, Icon, Loading, Empty, NoticeBar, Tabbar, TabbarItem } from 'vant'
import 'vant/lib/index.css'
import './style.css'
import App from './App.vue'
import { router } from './router'
const app = createApp(App)
for (const component of [Button, Field, Form, Cell, CellGroup, Icon, Loading, Empty, NoticeBar, Tabbar, TabbarItem]) app.use(component)
app.use(router).mount('#app')
