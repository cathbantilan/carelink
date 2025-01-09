import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/supabase'
import StaffDashboard from '@/views/StaffDashboard.vue';



const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: () => import('@/views/LoginView.vue')
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue')
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/staff-dashboard',
      name: 'staff-dashboard',
      component: () => import('@/views/StaffDashboard.vue'),
    },
    { 
      path: '/profile-dashboard', 
      name: 'profile-dashboard',
      component: () => import('@/views/ProfileDashboard.vue') 
    }
    
  ]
})

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const { data: { user } } = await supabase.auth.getUser()

  if (to.meta.requiresAuth && !user) {
    next('/')
  } else if ((to.name === 'login' || to.name === 'register') && user) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
