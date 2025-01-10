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

// Helper function to format time
function formatTime(time) {
  if (!time) return '';
  try {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  } catch (e) {
    console.error('Error formatting time:', e)
    return ''
  }
}

// Helper function to format date
function formatDate(dateString) {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    console.error('Error formatting date:', e)
    return ''
  }
}

// Helper function to get authenticated user
async function getAuthUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!user) throw new Error('No authenticated user found')
  return user
}

// Fetch all doctors with their available slots
async function fetchDoctors() {
  try {
    loading.value = true
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        specialty,
        email,
        available_slots!left (
          id,
          date,
          time,
          duration,
          is_booked,
          notes
        )
      `)
      .eq('role', 'Doctor')

    if (fetchError) throw fetchError

    // Process doctors data
    doctors.value = (data || [])
      .map(doctor => {
        // Filter available slots for this doctor
        const availableSlots = (doctor.available_slots || []).filter(slot => {
          if (!slot?.date || !slot?.time) return false;
          const slotDate = new Date(slot.date)
          slotDate.setHours(0, 0, 0, 0)
          return !slot.is_booked && slotDate >= today
        })

        return {
          id: doctor.id,
          first_name: doctor.first_name,
          last_name: doctor.last_name,
          specialty: doctor.specialty || 'General Practice',
          fullName: `Dr. ${doctor.first_name} ${doctor.last_name}`,
          email: doctor.email,
          availableSlots: availableSlots.length,
          slots: availableSlots
        }
      })
      .filter(doctor => doctor.availableSlots > 0)
      .sort((a, b) => b.availableSlots - a.availableSlots)

    // Restore selected doctor if exists
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
    console.error('Error fetching doctors:', e)
  } finally {
    loading.value = false
  }
}

// Fetch available slots for selected doctor
async function fetchAvailableSlots(doctor) {
  if (!doctor?.id) return;
  
  try {
    loading.value = true
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data, error: fetchError } = await supabase
      .from('available_slots')
      .select(`
        id,
        date,
        time,
        duration,
        is_booked,
        notes,
        doctor:doctor_id (
          id,
          first_name,
          last_name,
          specialty,
          email
        )
      `)
      .eq('doctor_id', doctor.id)
      .eq('is_booked', false)
      .gte('date', today.toISOString().split('T')[0])
      .order('date')
      .order('time')

    if (fetchError) throw fetchError

    // Map and filter slots
    availableSlots.value = (data || [])
      .filter(slot => {
        if (!slot?.date || !slot?.time) return false;
        const slotDate = new Date(slot.date)
        slotDate.setHours(0, 0, 0, 0)
        return slotDate >= today
      })
      .map(slot => ({
        ...slot,
        formattedTime: formatTime(slot.time),
        formattedDate: formatDate(slot.date),
        doctorName: slot.doctor ? `Dr. ${slot.doctor.first_name} ${slot.doctor.last_name}` : '',
        specialty: slot.doctor?.specialty || 'General Practice'
      }))

    console.log(`Found ${availableSlots.value.length} available slots for doctor ${doctor.fullName}`)
  } catch (e) {
    error.value = e.message
    console.error('Error fetching available slots:', e)
  } finally {
    loading.value = false
  }
}

// Fetch appointments for the current patient
async function fetchMyAppointments() {
  try {
    const user = await getAuthUser()
    
    const { data, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        status,
        notes,
        created_at,
        slot:slot_id (
          id,
          date,
          time,
          duration,
          notes,
          doctor:doctor_id (
            first_name,
            last_name,
            specialty,
            email
          )
        )
      `)
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) throw fetchError

    myAppointments.value = (data || [])
      .filter(appointment => appointment?.slot?.date && appointment?.slot?.time)
      .map(appointment => ({
        ...appointment,
        formattedTime: formatTime(appointment.slot.time),
        formattedDate: formatDate(appointment.slot.date),
        doctorName: appointment.slot.doctor 
          ? `Dr. ${appointment.slot.doctor.first_name} ${appointment.slot.doctor.last_name}`
          : 'Unknown Doctor',
        specialty: appointment.slot.doctor?.specialty || 'General Practice',
        date: appointment.slot.date
      }))
  } catch (e) {
    error.value = e.message
    console.error('Error fetching appointments:', e)
  }
}

// Book an appointment
async function bookAppointment(slot) {
  if (!slot?.id) return;
  
  try {
    loading.value = true
    const user = await getAuthUser()

    // Start a transaction by using multiple operations
    const { error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        patient_id: user.id,
        slot_id: slot.id,
        status: 'pending'
      })

    if (appointmentError) throw appointmentError

    const { error: slotError } = await supabase
      .from('available_slots')
      .update({ is_booked: true })
      .eq('id', slot.id)

    if (slotError) throw slotError

    // Refresh data
    await Promise.all([
      fetchAvailableSlots(selectedDoctor.value),
      fetchMyAppointments()
    ])
  } catch (e) {
    error.value = e.message
    console.error('Error booking appointment:', e)
  } finally {
    loading.value = false
  }
}

// Cancel an appointment
async function cancelAppointment(appointment) {
  if (!appointment?.id || !appointment?.slot_id) return;
  
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
    console.error('Error cancelling appointment:', e)
  } finally {
    loading.value = false
  }
}

// Delete a cancelled appointment
async function deleteAppointment(appointment) {
  if (!appointment?.id) return;
  
  try {
    loading.value = true
    
    const { error: deleteError } = await supabase
      .from('appointments')
      .delete()
      .eq('id', appointment.id)
      .eq('status', 'cancelled') // Extra safety check

    if (deleteError) throw deleteError

    await fetchMyAppointments()
  } catch (e) {
    error.value = e.message
    console.error('Error deleting appointment:', e)
  } finally {
    loading.value = false
  }
}

// Handle doctor selection change
async function handleDoctorChange() {
  if (selectedDoctor.value?.id) {
    localStorage.setItem('selectedDoctorId', selectedDoctor.value.id)
    await fetchAvailableSlots(selectedDoctor.value)
  } else {
    localStorage.removeItem('selectedDoctorId')
    availableSlots.value = []
  }
}

async function handleLogout() {
  try {
    loading.value = true
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) throw signOutError
    router.push('/login')
  } catch (e) {
    error.value = e.message
    console.error('Error during logout:', e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    await Promise.all([
      fetchDoctors(),
      fetchMyAppointments()
    ])
  } catch (e) {
    error.value = e.message
    console.error('Error during initialization:', e)
  }
})
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
                <div class="d-flex gap-2">
                  <v-btn
                    v-if="item.status !== 'cancelled'"
                    color="error"
                    size="small"
                    @click="cancelAppointment(item)"
                  >
                    Cancel
                  </v-btn>
                  <v-btn
                    v-if="item.status === 'cancelled'"
                    color="error"
                    size="small"
                    variant="outlined"
                    @click="deleteAppointment(item)"
                  >
                    Delete
                  </v-btn>
                </div>
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

.gap-2 {
  gap: 8px;
}

/* Add styles for action buttons */
.d-flex.gap-2 {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.v-btn.v-btn--size-small {
  min-width: 80px;
}
</style> 