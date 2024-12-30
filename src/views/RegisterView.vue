<script setup>
import AppLayout from '@/components/layout/AppLayout.vue'
import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const error = ref(null)

const roles = ['Student', 'Staff']

const form = ref({
  role: '',
  id_number: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
})

const rules = {
  required: v => !!v || 'This field is required',
  email: v => /.+@.+\..+/.test(v) || 'Please enter a valid email',
  phone: v => /^\d{10}$/.test(v) || 'Please enter a valid 10-digit phone number',
  password: v => v.length >= 6 || 'Password must be at least 6 characters',
  passwordMatch: v => v === form.value.password || 'Passwords do not match',
}

async function handleRegister() {
  try {
    loading.value = true
    error.value = null

    if (form.value.password !== form.value.confirmPassword) {
      throw new Error('Passwords do not match')
    }

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.value.email,
      password: form.value.password,
      options: {
        data: {
          id_number: form.value.id_number,
          role: form.value.role,
        }
      }
    })

    if (authError) throw authError

    if (!authData.user?.id) {
      throw new Error('No user id returned from authentication')
    }

    // 2. Insert profile data
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        id_number: form.value.id_number,
        first_name: form.value.firstName,
        last_name: form.value.lastName,
        email: form.value.email,
        phone: form.value.phone,
        role: form.value.role
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // If profile creation fails, we should delete the auth user
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw new Error('Failed to create profile. Please try again.')
    }

    // Show success message
    alert('Registration successful! Please check your email to confirm your account.')
    
    // Redirect to login
    router.push('/')
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
          <v-card class="mx-auto" color="grey-lighten-1" rounded="lg" elevation="3">
            <template v-slot:title>
              <div class="text-center fs-5 mb-5" style="font-weight: bold; font-size: 2rem">
                Sign Up
              </div>
            </template>

            <v-card-text class="bg-surface-light pt-4">
              <v-form fast-fail @submit.prevent="handleRegister">
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
                  variant="outlined"
                  :rules="[rules.required]"
                  required
                ></v-select>

                <v-text-field
                  v-model="form.id_number"
                  label="ID Number"
                  variant="outlined"
                  :rules="[rules.required]"
                  required
                ></v-text-field>

                <v-text-field
                  v-model="form.firstName"
                  label="First Name"
                  variant="outlined"
                  :rules="[rules.required]"
                  required
                ></v-text-field>

                <v-text-field
                  v-model="form.lastName"
                  label="Last Name"
                  variant="outlined"
                  :rules="[rules.required]"
                  required
                ></v-text-field>

                <v-text-field
                  v-model="form.email"
                  label="Email"
                  variant="outlined"
                  :rules="[rules.required, rules.email]"
                  required
                ></v-text-field>

                <v-text-field
                  v-model="form.phone"
                  label="Phone Number"
                  variant="outlined"
                  :rules="[rules.required, rules.phone]"
                  required
                ></v-text-field>

                <v-text-field
                  v-model="form.password"
                  label="Password"
                  type="password"
                  variant="outlined"
                  :rules="[rules.required, rules.password]"
                  required
                ></v-text-field>

                <v-text-field
                  v-model="form.confirmPassword"
                  label="Confirm Password"
                  type="password"
                  variant="outlined"
                  :rules="[rules.required, rules.passwordMatch]"
                  required
                ></v-text-field>

                <v-btn
                  class="rounded-s-lg mt-2"
                  type="submit"
                  block
                  color="green-darken-3"
                  :loading="loading"
                >
                  Register
                </v-btn>
              </v-form>
              <v-divider class="my-5"></v-divider>
              <h5 class="text-center">
                Already have an account?
                <RouterLink to="/"><b>Click here to Login</b></RouterLink>
              </h5>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </AppLayout>
</template>
