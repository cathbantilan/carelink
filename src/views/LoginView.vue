<script setup>
import AppLayout from '@/components/layout/AppLayout.vue'
import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const error = ref(null)

const form = ref({
  email: '',
  password: '',
})

async function handleLogin() {
  try {
    loading.value = true
    error.value = null
    
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: form.value.email,
      password: form.value.password,
    })

    if (authError) throw authError

    // Successful login
    router.push('/dashboard')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AppLayout>
    <template #content>
      <v-row class="d-flex justify-center mt-5">
        <v-col cols="12" md="6" class="mx-auto">
          <v-card class="mx-auto" color="grey-lighten-1" rounded="lg" elevation="8">
            <template v-slot:title>
              <div class="text-center fs-5 mb-4" style="font-weight: bold; font-size: 2rem">
                CareLink
              </div>
            </template>

            <v-card-text class="bg-surface-light pt-4">
              <v-form fast-fail @submit.prevent="handleLogin">
                <v-alert
                  v-if="error"
                  type="error"
                  class="mb-4"
                  closable
                  @click:close="error = null"
                >
                  {{ error }}
                </v-alert>

                <p>Email:</p>
                <v-text-field
                  v-model="form.email"
                  prepend-inner-icon="mdi-email"
                  label="Enter your email"
                  color="green"
                  placeholder="Email"
                  :rules="[v => !!v || 'Email is required']"
                  required
                ></v-text-field>

                <p>Password:</p>
                <v-text-field
                  v-model="form.password"
                  prepend-inner-icon="mdi-lock"
                  label="Enter your password"
                  color="green"
                  placeholder="Password"
                  type="password"
                  :rules="[v => !!v || 'Password is required']"
                  required
                ></v-text-field>

                <v-btn
                  class="rounded-s-lg"
                  type="submit"
                  block
                  color="green-darken-3"
                  :loading="loading"
                >
                  Log in
                </v-btn>
              </v-form>
              <v-divider class="my-5"></v-divider>
              <h5 class="text-center">
                Don't have an account?
                <router-link to="/register"><b>Click here to Register</b></router-link>
              </h5>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </AppLayout>
</template>
