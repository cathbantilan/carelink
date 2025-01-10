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
  role: ''
})

const roles = ['Patient', 'Doctor']

async function handleLogin() {
  try {
    loading.value = true
    error.value = null
    
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: form.value.email,
      password: form.value.password,
    })

    if (authError) throw authError

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profileError) throw profileError

    if (profile.role !== form.value.role) {
      throw new Error(`Invalid role selected. You are registered as a ${profile.role}`)
    }

    if (profile.role === 'Doctor') {
      router.push('/doctor-dashboard')
    } else {
      router.push('/patient-dashboard')
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-app>
    <AppLayout>
      <template #content>
        <v-container>
          <v-row class="d-flex justify-between align-center mt-5">
            <!-- Left Side: Text Content -->
            <v-col cols="12" md="6" class="text-section">
              <div class="text-container">
                <h1 class="welcome-animation">Welcome to CareLink</h1>
                <p style="margin-left: 58px; color:#000000; font-size: 18px;">
                  University Clinic Appointment Booking System
                </p>
              </div>
            </v-col>

            <!-- Right Side: Login Form -->
            <v-col cols="12" md="6">
              <v-card
                class="login-form"
                color="grey-lighten-1"
                rounded="lg"
                elevation="8"
              >
                <template v-slot:title>
                  <div class="text-center fs-5 mb-4" style="font-weight: bold; font-size: 2rem">
                    CareLink
                  </div>
                </template>

                <v-card-text class="bg-surface-light pt-4">
                  <v-form @submit.prevent="handleLogin">
                    <v-alert
                      v-if="error"
                      type="error"
                      class="mb-4"
                      closable
                      @click:close="error = null"
                    >
                      {{ error }}
                    </v-alert>

                    <v-select
                      v-model="form.role"
                      :items="roles"
                      label="Select Role"
                      required
                      :rules="[v => !!v || 'Role is required']"
                    ></v-select>

                    <v-text-field
                      v-model="form.email"
                      label="Email"
                      type="email"
                      required
                      :rules="[v => !!v || 'Email is required']"
                    ></v-text-field>

                    <v-text-field
                      v-model="form.password"
                      label="Password"
                      type="password"
                      required
                      :rules="[v => !!v || 'Password is required']"
                    ></v-text-field>

                    <v-btn
                      type="submit"
                      block
                      color="primary"
                      :loading="loading"
                    >
                      Login
                    </v-btn>
                  </v-form>

                  <v-divider class="my-4"></v-divider>
                  
                  <div class="text-center">
                    <router-link to="/register">
                      Don't have an account? Register here
                    </router-link>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-container>
      </template>
    </AppLayout>
  </v-app>
</template>

<style scoped>
.login-form {
  max-width: 500px;
  margin: 0 auto;
}

.text-container {
  padding: 20px;
}

.welcome-animation {
  font-size: 2.5rem;
  font-weight: bold;
  color: #2c3e50;
  text-align: center;
}
</style>