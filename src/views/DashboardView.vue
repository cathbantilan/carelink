<script setup>
import AppLayout from '@/components/layout/AppLayout.vue'
import { onMounted, ref } from 'vue'
import { supabase } from '@/supabase'
import { useRouter } from 'vue-router'

const router = useRouter()
const user = ref(null)
const loading = ref(false)

onMounted(async () => {
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) {
    router.push('/')
    return
  }
  user.value = currentUser
})

async function handleLogout() {
  try {
    loading.value = true
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    
    // Redirect to login page after successful logout
    router.push('/')
  } catch (e) {
    console.error('Error logging out:', e.message)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AppLayout>
    <template #content>
      <v-container>
        <v-row justify="space-between" align="center" class="mb-6">
          <v-col cols="auto">
            <h1 class="text-h4">Welcome to Dashboard</h1>
          </v-col>
          <v-col cols="auto">
            <v-btn
              color="red"
              @click="handleLogout"
              :loading="loading"
              prepend-icon="mdi-logout"
            >
              Logout
            </v-btn>
          </v-col>
        </v-row>

        <v-card class="pa-4" v-if="user">
          <v-card-title>User Information</v-card-title>
          <v-card-text>
            <p class="text-body-1">Email: {{ user.email }}</p>
            <p class="text-body-1">Last Sign In: {{ new Date(user.last_sign_in_at).toLocaleString() }}</p>
          </v-card-text>
        </v-card>
      </v-container>
    </template>
  </AppLayout>
</template> 