<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/supabase'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const availableSlots = ref([])
const myAppointments = ref([])
const doctors = ref([])
const selectedDoctor = ref(null)
const loading = ref(false)
const error = ref(null)
const hasAvailableDoctors = computed(() => doctors.value.length > 0)
const noAvailableDoctors = computed(() => !loading.value && doctors.value.length === 0)

onMounted(async () => {
  await Promise.all([
    fetchDoctors(),
    fetchMyAppointments()
  ])
})

// Fetch all doctors
async function fetchDoctors() {
  try {
    loading.value = true
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        specialty,
        available_slots!inner (
          id,
          date,
          time,
          is_booked
        )
      `)
      .eq('role', 'Doctor')
      .eq('available_slots.is_booked', false)
      .gte('available_slots.date', new Date().toISOString().split('T')[0])

    if (fetchError) throw fetchError

    // Filter and format doctors data
    doctors.value = data
      .filter(doctor => doctor.available_slots && doctor.available_slots.length > 0)
      .map(doctor => ({
        id: doctor.id,
        first_name: doctor.first_name,
        last_name: doctor.last_name,
        specialty: doctor.specialty || 'General Practice',
        fullName: `Dr. ${doctor.first_name} ${doctor.last_name}`,
        availableSlots: doctor.available_slots.length
      }))

    // Try to restore selected doctor from localStorage
    const savedDoctorId = localStorage.getItem('selectedDoctorId')
    if (savedDoctorId) {
      const savedDoctor = doctors.value.find(d => d.id === savedDoctorId)
      if (savedDoctor) {
        selectedDoctor.value = savedDoctor
        await fetchAvailableSlots(savedDoctor)
      }
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// Watch for selected doctor changes
async function handleDoctorChange() {
  if (selectedDoctor.value) {
    localStorage.setItem('selectedDoctorId', selectedDoctor.value.id)
    await fetchAvailableSlots(selectedDoctor.value)
  } else {
    localStorage.removeItem('selectedDoctorId')
    availableSlots.value = []
  }
}

function formatTime(time) {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

async function fetchAvailableSlots(doctorId) {
  try {
    loading.value = true
    const { data, error: fetchError } = await supabase
      .from('available_slots')
      .select(`
        *,
        doctor:doctor_id (
          id,
          email,
          profiles (
            first_name,
            last_name,
            specialty
          )
        )
      `)
      .eq('doctor_id', doctorId.id)
      .eq('is_booked', false)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    if (fetchError) throw fetchError

    availableSlots.value = data.map(slot => ({
      ...slot,
      formattedTime: formatTime(slot.time),
      doctorName: `Dr. ${slot.doctor.profiles[0].first_name} ${slot.doctor.profiles[0].last_name}`,
      specialty: slot.doctor.profiles[0].specialty
    }))
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function fetchMyAppointments() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        *,
        slot:slot_id (
          date,
          time,
          doctor:doctor_id (
            profiles (
              first_name,
              last_name,
              specialty
            )
          )
        )
      `)
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) throw fetchError

    myAppointments.value = data.map(appointment => ({
      ...appointment,
      formattedTime: formatTime(appointment.slot.time),
      doctorName: `Dr. ${appointment.slot.doctor.profiles[0].first_name} ${appointment.slot.doctor.profiles[0].last_name}`,
      specialty: appointment.slot.doctor.profiles[0].specialty
    }))
  } catch (e) {
    error.value = e.message
  }
}

async function bookAppointment(slot) {
  try {
    loading.value = true
    const { data: { user } } = await supabase.auth.getUser()

    // Create appointment
    const { error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        patient_id: user.id,
        slot_id: slot.id,
        status: 'pending'
      })

    if (appointmentError) throw appointmentError

    // Update slot status
    const { error: slotError } = await supabase
      .from('available_slots')
      .update({ is_booked: true })
      .eq('id', slot.id)

    if (slotError) throw slotError

    await Promise.all([
      fetchAvailableSlots(selectedDoctor.value),
      fetchMyAppointments()
    ])
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function cancelAppointment(appointment) {
  try {
    loading.value = true

    // Update appointment status
    const { error: appointmentError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointment.id)

    if (appointmentError) throw appointmentError

    // Update slot status
    const { error: slotError } = await supabase
      .from('available_slots')
      .update({ is_booked: false })
      .eq('id', appointment.slot_id)

    if (slotError) throw slotError

    await Promise.all([
      fetchAvailableSlots(selectedDoctor.value),
      fetchMyAppointments()
    ])
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function handleLogout() {
  try {
    loading.value = true
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    router.push('/login')
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
      <v-container>
        <v-row class="mb-6">
          <v-col cols="12" class="d-flex justify-space-between align-center">
            <h1 class="text-h4">Patient Dashboard</h1>
            <v-btn
              color="error"
              @click="handleLogout"
              :loading="loading"
              prepend-icon="mdi-logout"
            >
              Logout
            </v-btn>
          </v-col>
        </v-row>

        <v-alert
          v-if="error"
          type="error"
          class="mb-4"
          closable
          @click:close="error = null"
        >
          {{ error }}
        </v-alert>

        <!-- Doctor Selection -->
        <v-card class="mb-6">
          <v-card-title class="text-h5 pa-4">
            Available Doctors
          </v-card-title>
          
          <v-card-text>
            <v-row>
              <v-col cols="12">
                <v-select
                  v-model="selectedDoctor"
                  :items="doctors"
                  item-title="fullName"
                  item-value="id"
                  label="Choose a Doctor"
                  @update:model-value="handleDoctorChange"
                  return-object
                  :hint="selectedDoctor ? `${selectedDoctor.specialty} - ${selectedDoctor.availableSlots} slots available` : 'Select a doctor to view available appointments'"
                  persistent-hint
                >
                  <template v-slot:item="{ props, item }">
                    <v-list-item v-bind="props">
                      <template v-slot:prepend>
                        <v-avatar color="primary" size="32">
                          <span class="text-h6 text-white">{{ item.raw.first_name[0] }}</span>
                        </v-avatar>
                      </template>
                      <template v-slot:title>
                        <span class="font-weight-bold">{{ item.raw.fullName }}</span>
                      </template>
                      <template v-slot:subtitle>
                        <span>{{ item.raw.specialty }}</span>
                        <v-chip
                          class="ml-2"
                          color="primary"
                          size="x-small"
                          label
                        >
                          {{ item.raw.availableSlots }} slots
                        </v-chip>
                      </template>
                    </v-list-item>
                  </template>
                </v-select>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-alert
          v-if="noAvailableDoctors"
          type="info"
          class="mb-6"
        >
          No doctors with available slots at the moment. Please check back later.
        </v-alert>

        <!-- Available Slots -->
        <v-card class="mb-6" v-if="selectedDoctor">
          <v-card-title class="text-h5 pa-4 d-flex align-center">
            <span>Available Appointments with {{ selectedDoctor.fullName }}</span>
            <v-chip class="ml-4" color="info" size="small">
              {{ selectedDoctor.specialty }}
            </v-chip>
          </v-card-title>
          
          <v-card-text>
            <v-data-table
              :headers="[
                { title: 'Date', key: 'date', align: 'start' },
                { title: 'Time', key: 'formattedTime', align: 'start' },
                { title: 'Duration', key: 'duration', align: 'start' },
                { title: 'Actions', key: 'actions', align: 'center' }
              ]"
              :items="availableSlots"
              :loading="loading"
              class="elevation-1"
            >
              <template v-slot:item.date="{ item }">
                {{ new Date(item.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) }}
              </template>

              <template v-slot:item.duration="{ item }">
                {{ item.duration }} minutes
              </template>

              <template v-slot:item.actions="{ item }">
                <v-btn
                  color="primary"
                  size="small"
                  @click="bookAppointment(item)"
                  :loading="loading"
                >
                  Book Appointment
                </v-btn>
              </template>

              <template v-slot:no-data>
                <div class="text-center pa-4">
                  <v-icon icon="mdi-calendar-blank" size="large" color="grey" class="mb-2" />
                  <div class="text-grey">No available slots for this doctor</div>
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>

        <!-- My Appointments -->
        <v-card>
          <v-card-title class="text-h5 pa-4">
            My Appointments
          </v-card-title>
          
          <v-card-text>
            <v-data-table
              :headers="[
                { title: 'Date', key: 'slot.date', align: 'start' },
                { title: 'Time', key: 'formattedTime', align: 'start' },
                { title: 'Doctor', key: 'doctorName', align: 'start' },
                { title: 'Specialty', key: 'specialty', align: 'start' },
                { title: 'Status', key: 'status', align: 'start' },
                { title: 'Actions', key: 'actions', align: 'center' }
              ]"
              :items="myAppointments"
              :loading="loading"
              class="elevation-1"
            >
              <template v-slot:item.status="{ item }">
                <v-chip
                  :color="item.status === 'confirmed' ? 'success' : item.status === 'pending' ? 'warning' : 'error'"
                  size="small"
                >
                  {{ item.status }}
                </v-chip>
              </template>

              <template v-slot:item.actions="{ item }">
                <v-btn
                  v-if="item.status !== 'cancelled'"
                  color="error"
                  size="small"
                  @click="cancelAppointment(item)"
                >
                  Cancel
                </v-btn>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-container>
    </template>
  </AppLayout>
</template>

<style scoped>
.v-card {
  margin-bottom: 20px;
}

.text-h4 {
  color: #1976d2;
  font-weight: 600;
}

.text-h5 {
  color: #1976d2;
  font-weight: 500;
}

.v-data-table {
  background-color: white;
}

.doctor-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.doctor-card:hover {
  transform: translateY(-2px);
}

.selected-doctor {
  border: 2px solid #1976d2;
}

.v-avatar {
  margin-right: 8px;
}

.specialty-chip {
  margin-left: 8px;
}
</style> 