<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/supabase'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const availableSlots = ref([])
const appointments = ref([])
const newSlot = ref({
  date: null,
  time: '',
  duration: 30,
  notes: ''
})
const loading = ref(false)
const error = ref(null)
const showNotesDialog = ref(false)
const selectedAppointment = ref(null)
const doctorNotes = ref('')
const activeTab = ref('upcoming')
const searchQuery = ref('')
const showActionDialog = ref(false)
const actionDialogType = ref(null) // 'cancel' or 'delete'
const selectedSlot = ref(null)

// Time slots in 24-hour format with AM/PM
const timeSlots = [
  { value: '09:00', label: '9:00 AM' },
  { value: '09:30', label: '9:30 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '10:30', label: '10:30 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '11:30', label: '11:30 AM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '13:30', label: '1:30 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '14:30', label: '2:30 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '15:30', label: '3:30 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '16:30', label: '4:30 PM' }
]

const durationOptions = [
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' }
]

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

async function fetchMySlots() {
  try {
    loading.value = true
    const user = await getAuthUser()
    
    const { data, error: fetchError } = await supabase
      .from('available_slots')
      .select(`
        id,
        date,
        time,
        duration,
        is_booked,
        notes,
        appointments (
          id,
          status,
          notes,
          patient:patient_id (
            first_name,
            last_name,
            email
          )
        )
      `)
      .eq('doctor_id', user.id)
      .order('date')
      .order('time')

    if (fetchError) throw fetchError
    
    availableSlots.value = (data || [])
      .filter(slot => slot && slot.date && slot.time)
      .map(slot => {
        const appointment = slot.appointments?.[0]
        return {
          ...slot,
          formattedTime: formatTime(slot.time),
          formattedDate: formatDate(slot.date),
          appointmentStatus: appointment?.status || null,
          patientName: appointment?.patient 
            ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
            : null
        }
      })

    console.log(`Found ${availableSlots.value.length} total slots`)
  } catch (e) {
    error.value = e.message
    console.error('Error fetching slots:', e)
  } finally {
    loading.value = false
  }
}

async function fetchAppointments() {
  try {
    loading.value = true
    const user = await getAuthUser()
    
    const { data, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        status,
        notes,
        created_at,
        patient:patient_id (
          first_name,
          last_name,
          email
        ),
        slot:slot_id (
          id,
          date,
          time,
          duration,
          notes
        )
      `)
      .eq('slot.doctor_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) throw fetchError

    appointments.value = (data || [])
      .filter(appointment => appointment?.slot?.date && appointment?.slot?.time)
      .map(appointment => ({
        ...appointment,
        formattedTime: formatTime(appointment.slot.time),
        formattedDate: formatDate(appointment.slot.date),
        patientName: appointment.patient 
          ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
          : 'Unknown Patient'
      }))

    console.log(`Found ${appointments.value.length} appointments`)
  } catch (e) {
    error.value = e.message
    console.error('Error fetching appointments:', e)
  } finally {
    loading.value = false
  }
}

async function addTimeSlot() {
  if (!newSlot.value.date || !newSlot.value.time) {
    error.value = 'Please select both date and time'
    return
  }

  try {
    loading.value = true
    const user = await getAuthUser()

    // Validate the date
    const slotDate = new Date(newSlot.value.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (slotDate < today) {
      throw new Error('Cannot create slots for past dates')
    }

    // Get the time value from the selected time object
    const timeValue = typeof newSlot.value.time === 'object' ? 
      newSlot.value.time.value : newSlot.value.time

    // Check for existing slot
    const { data: existingSlot } = await supabase
      .from('available_slots')
      .select('id')
      .eq('date', newSlot.value.date)
      .eq('time', timeValue)
      .eq('doctor_id', user.id)
      .single()

    if (existingSlot) {
      throw new Error('You already have a slot at this time')
    }

    // Add new slot
    const { error: insertError } = await supabase
      .from('available_slots')
      .insert({
        doctor_id: user.id,
        date: newSlot.value.date,
        time: timeValue,
        duration: newSlot.value.duration || 30,
        notes: newSlot.value.notes || '',
        is_booked: false
      })

    if (insertError) throw insertError

    // Reset form and refresh data
    newSlot.value = { date: null, time: '', duration: 30, notes: '' }
    await Promise.all([
      fetchMySlots(),
      fetchAppointments()
    ])
  } catch (e) {
    error.value = e.message
    console.error('Error adding time slot:', e)
  } finally {
    loading.value = false
  }
}

async function updateAppointmentStatus(appointment, newStatus) {
  if (!appointment?.id) return;
  
  try {
    loading.value = true
    const updates = { 
      status: newStatus,
      notes: newStatus === 'confirmed' ? doctorNotes.value : null 
    }

    const { error: updateError } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', appointment.id)

    if (updateError) throw updateError

    if (newStatus === 'cancelled' && appointment.slot_id) {
      const { error: slotError } = await supabase
        .from('available_slots')
        .update({ is_booked: false })
        .eq('id', appointment.slot_id)

      if (slotError) throw slotError
    }

    showNotesDialog.value = false
    selectedAppointment.value = null
    doctorNotes.value = ''
    
    await Promise.all([
      fetchMySlots(),
      fetchAppointments()
    ])
  } catch (e) {
    error.value = e.message
    console.error('Error updating appointment status:', e)
  } finally {
    loading.value = false
  }
}

function openNotesDialog(appointment) {
  if (!appointment) return
  selectedAppointment.value = appointment
  doctorNotes.value = appointment.notes || ''
  showNotesDialog.value = true
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

async function updateSlotStatus(slot) {
  if (!slot?.id) return;
  
  try {
    loading.value = true
    const updates = { 
      is_booked: !slot.is_booked,
      notes: !slot.is_booked ? 'Marked as unavailable by doctor' : null
    }

    const { error: updateError } = await supabase
      .from('available_slots')
      .update(updates)
      .eq('id', slot.id)

    if (updateError) throw updateError

    // If marking as unavailable and there's an appointment, cancel it
    if (!slot.is_booked && slot.appointments?.[0]?.id) {
      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ 
          status: 'cancelled',
          notes: 'Cancelled - slot marked as unavailable by doctor'
        })
        .eq('id', slot.appointments[0].id)

      if (appointmentError) throw appointmentError
    }

    await Promise.all([
      fetchMySlots(),
      fetchAppointments()
    ])
  } catch (e) {
    error.value = e.message
    console.error('Error updating slot status:', e)
  } finally {
    loading.value = false
  }
}

const upcomingSlots = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  return availableSlots.value
    .filter(slot => {
      const slotDate = new Date(slot.date)
      return slotDate >= today
    })
    .filter(slot => {
      if (!searchQuery.value) return true
      const query = searchQuery.value.toLowerCase()
      return (
        slot.formattedDate.toLowerCase().includes(query) ||
        slot.formattedTime.toLowerCase().includes(query) ||
        (slot.patientName && slot.patientName.toLowerCase().includes(query)) ||
        (slot.appointmentStatus && slot.appointmentStatus.toLowerCase().includes(query))
      )
    })
})

const pastSlots = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  return availableSlots.value
    .filter(slot => {
      const slotDate = new Date(slot.date)
      return slotDate < today
    })
    .filter(slot => {
      if (!searchQuery.value) return true
      const query = searchQuery.value.toLowerCase()
      return (
        slot.formattedDate.toLowerCase().includes(query) ||
        slot.formattedTime.toLowerCase().includes(query) ||
        (slot.patientName && slot.patientName.toLowerCase().includes(query)) ||
        (slot.appointmentStatus && slot.appointmentStatus.toLowerCase().includes(query))
      )
    })
})

function getStatusColor(slot) {
  if (!slot.is_booked) return 'info'
  switch (slot.appointmentStatus) {
    case 'confirmed': return 'success'
    case 'pending': return 'warning'
    case 'cancelled': return 'error'
    default: return 'grey'
  }
}

function getStatusText(slot) {
  if (!slot.is_booked) return 'Available'
  return slot.appointmentStatus ? slot.appointmentStatus.charAt(0).toUpperCase() + slot.appointmentStatus.slice(1) : 'Unknown'
}

function getStatusTooltip(slot) {
  if (!slot.is_booked) return 'Slot is available for booking'
  switch (slot.appointmentStatus) {
    case 'confirmed': return 'Appointment has been confirmed'
    case 'pending': return 'Waiting for your confirmation'
    case 'cancelled': return 'Appointment was cancelled'
    default: return 'Unknown status'
  }
}

async function deleteSlot(slot) {
  if (!slot?.id) return
  
  try {
    loading.value = true

    // First check if the slot has any appointments
    const { data: appointmentCheck, error: checkError } = await supabase
      .from('appointments')
      .select('id, status')
      .eq('slot_id', slot.id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') throw checkError // PGRST116 means no rows returned

    if (appointmentCheck && appointmentCheck.status !== 'cancelled') {
      throw new Error('Cannot delete slot with active appointment')
    }

    // Delete any cancelled appointments first
    if (appointmentCheck) {
      const { error: appointmentDeleteError } = await supabase
        .from('appointments')
        .delete()
        .eq('slot_id', slot.id)
        .eq('status', 'cancelled')

      if (appointmentDeleteError) throw appointmentDeleteError
    }

    // Delete the slot
    const { error: deleteError } = await supabase
      .from('available_slots')
      .delete()
      .eq('id', slot.id)

    if (deleteError) throw deleteError

    // Refresh data
    await Promise.all([
      fetchMySlots(),
      fetchAppointments()
    ])

    // Close dialog and clear selection
    showActionDialog.value = false
    selectedSlot.value = null
    actionDialogType.value = null
  } catch (e) {
    error.value = e.message
    console.error('Error deleting slot:', e)
  } finally {
    loading.value = false
  }
}

function openActionDialog(slot, action) {
  selectedSlot.value = slot
  actionDialogType.value = action
  showActionDialog.value = true
}

async function handleActionConfirm() {
  if (!selectedSlot.value || !actionDialogType.value) return

  if (actionDialogType.value === 'delete') {
    await deleteSlot(selectedSlot.value)
  } else if (actionDialogType.value === 'cancel') {
    await updateSlotStatus(selectedSlot.value)
  }
}

onMounted(async () => {
  try {
    await Promise.all([
      fetchMySlots(),
      fetchAppointments()
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
        <!-- Header Section -->
        <v-row class="mb-6">
          <v-col cols="12" class="d-flex justify-space-between align-center">
            <div>
              <h1 class="text-h4 mb-2">Doctor Dashboard</h1>
              <v-chip
                color="primary"
                size="small"
                class="mr-2"
                prepend-icon="mdi-calendar-clock"
              >
                {{ availableSlots.length }} Total Slots
              </v-chip>
              <v-chip
                :color="appointments.filter(a => a.status === 'pending').length > 0 ? 'warning' : 'success'"
                size="small"
                prepend-icon="mdi-clock-alert"
              >
                {{ appointments.filter(a => a.status === 'pending').length }} Pending Appointments
              </v-chip>
            </div>
            <v-btn
              color="error"
              @click="handleLogout"
              :loading="loading"
              prepend-icon="mdi-logout"
              variant="tonal"
            >
              Logout
            </v-btn>
          </v-col>
        </v-row>
        
        <!-- Error Alert -->
        <v-alert
          v-if="error"
          type="error"
          class="mb-4"
          closable
          variant="tonal"
          @click:close="error = null"
        >
          {{ error }}
        </v-alert>

        <!-- Add Time Slot Card -->
        <v-card class="mb-6" elevation="2">
          <v-card-title class="text-h5 pa-4 d-flex align-center">
            <v-icon icon="mdi-calendar-plus" class="mr-2" color="primary"></v-icon>
            Add New Time Slot
          </v-card-title>
          
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-date-picker
                  v-model="newSlot.date"
                  :min="new Date().toISOString().split('T')[0]"
                  class="mx-auto elevation-2"
                  color="primary"
                  header-color="primary"
                ></v-date-picker>
              </v-col>

              <v-col cols="12" md="6" class="d-flex flex-column">
                <v-select
                  v-model="newSlot.time"
                  :items="timeSlots"
                  item-title="label"
                  item-value="value"
                  label="Select Time"
                  class="mb-4"
                  hint="Philippine Time (PHT)"
                  persistent-hint
                  variant="outlined"
                  prepend-inner-icon="mdi-clock"
                  :menu-props="{ maxHeight: 400 }"
                >
                  <template v-slot:item="{ props, item }">
                    <v-list-item v-bind="props">
                      <template v-slot:prepend>
                        <v-icon icon="mdi-clock-outline"></v-icon>
                      </template>
                      <template v-slot:title>
                        {{ item.raw.label }}
                      </template>
                    </v-list-item>
                  </template>
                </v-select>

                <v-select
                  v-model="newSlot.duration"
                  :items="durationOptions"
                  item-title="label"
                  item-value="value"
                  label="Duration"
                  class="mb-4"
                  variant="outlined"
                  prepend-inner-icon="mdi-timer"
                ></v-select>

                <v-textarea
                  v-model="newSlot.notes"
                  label="Notes (Optional)"
                  rows="3"
                  class="mb-4"
                  variant="outlined"
                  prepend-inner-icon="mdi-note"
                  placeholder="Add any special instructions or notes"
                ></v-textarea>

                <v-btn
                  color="primary"
                  :loading="loading"
                  :disabled="!newSlot.date || !newSlot.time"
                  @click="addTimeSlot"
                  block
                  size="large"
                  prepend-icon="mdi-plus"
                  class="mt-auto"
                >
                  Add Time Slot
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Appointments Management Card -->
        <v-card elevation="2">
          <v-card-title class="text-h5 pa-4 d-flex align-center">
            <v-icon icon="mdi-calendar-check" class="mr-2" color="primary"></v-icon>
            My Appointments
            <v-spacer></v-spacer>
            <v-text-field
              v-model="searchQuery"
              append-inner-icon="mdi-magnify"
              label="Search appointments"
              single-line
              hide-details
              density="compact"
              class="ml-4"
              style="max-width: 300px"
              variant="outlined"
            ></v-text-field>
          </v-card-title>
          
          <v-card-text>
            <v-tabs
              v-model="activeTab"
              color="primary"
              align-tabs="center"
              class="mb-4"
            >
              <v-tab value="upcoming">
                <v-icon icon="mdi-calendar-arrow-right" class="mr-2"></v-icon>
                Upcoming Slots
              </v-tab>
              <v-tab value="past">
                <v-icon icon="mdi-calendar-arrow-left" class="mr-2"></v-icon>
                Past Slots
              </v-tab>
            </v-tabs>

            <v-window v-model="activeTab">
              <v-window-item value="upcoming">
                <v-data-table
                  :headers="[
                    { title: 'Date', key: 'formattedDate', align: 'start', sortable: true },
                    { title: 'Time', key: 'formattedTime', align: 'start', sortable: true },
                    { title: 'Duration', key: 'duration', align: 'start' },
                    { title: 'Patient', key: 'patientName', align: 'start' },
                    { title: 'Status', key: 'status', align: 'start' },
                    { title: 'Actions', key: 'actions', align: 'center' }
                  ]"
                  :items="upcomingSlots"
                  :loading="loading"
                  :search="searchQuery"
                  class="elevation-1"
                >
                  <template v-slot:item.duration="{ item }">
                    <v-chip size="small" color="info" variant="tonal">
                      {{ item.duration }} minutes
                    </v-chip>
                  </template>

                  <template v-slot:item.patientName="{ item }">
                    <div v-if="item.patientName" class="d-flex align-center">
                      <v-avatar size="32" color="primary" class="mr-2">
                        <span class="text-white">{{ item.patientName[0] }}</span>
                      </v-avatar>
                      {{ item.patientName }}
                    </div>
                    <v-chip v-else size="small" color="grey" variant="tonal">
                      No patient
                    </v-chip>
                  </template>
                  
                  <template v-slot:item.status="{ item }">
                    <v-tooltip :text="getStatusTooltip(item)">
                      <template v-slot:activator="{ props }">
                        <v-chip
                          v-bind="props"
                          :color="getStatusColor(item)"
                          size="small"
                        >
                          {{ getStatusText(item) }}
                        </v-chip>
                      </template>
                    </v-tooltip>
                  </template>

                  <template v-slot:item.actions="{ item }">
                    <div class="d-flex justify-center gap-2">
                      <v-btn
                        v-if="item.is_booked && item.appointmentStatus === 'pending'"
                        color="success"
                        size="small"
                        variant="tonal"
                        prepend-icon="mdi-check"
                        @click="openNotesDialog(item.appointments[0])"
                      >
                        Confirm
                      </v-btn>

                      <v-btn
                        v-if="item.is_booked"
                        color="warning"
                        size="small"
                        variant="tonal"
                        prepend-icon="mdi-cancel"
                        @click="openActionDialog(item, 'cancel')"
                      >
                        Cancel
                      </v-btn>

                      <v-btn
                        v-if="!item.is_booked"
                        color="error"
                        size="small"
                        variant="tonal"
                        prepend-icon="mdi-delete"
                        @click="openActionDialog(item, 'delete')"
                      >
                        Delete Slot
                      </v-btn>
                    </div>
                  </template>

                  <template v-slot:no-data>
                    <div class="d-flex flex-column align-center pa-4">
                      <v-icon icon="mdi-calendar-blank" size="64" color="grey" class="mb-2"></v-icon>
                      <div class="text-grey text-body-1">No upcoming appointments found</div>
                      <div class="text-grey-darken-1 text-caption">Try adding new time slots</div>
                    </div>
                  </template>
                </v-data-table>
              </v-window-item>

              <v-window-item value="past">
                <v-data-table
                  :headers="[
                    { title: 'Date', key: 'formattedDate', align: 'start', sortable: true },
                    { title: 'Time', key: 'formattedTime', align: 'start', sortable: true },
                    { title: 'Duration', key: 'duration', align: 'start' },
                    { title: 'Patient', key: 'patientName', align: 'start' },
                    { title: 'Status', key: 'status', align: 'start' }
                  ]"
                  :items="pastSlots"
                  :loading="loading"
                  :search="searchQuery"
                  class="elevation-1"
                >
                  <template v-slot:item.duration="{ item }">
                    <v-chip size="small" color="info" variant="tonal">
                      {{ item.duration }} minutes
                    </v-chip>
                  </template>

                  <template v-slot:item.patientName="{ item }">
                    <div v-if="item.patientName" class="d-flex align-center">
                      <v-avatar size="32" color="grey" class="mr-2">
                        <span class="text-white">{{ item.patientName[0] }}</span>
                      </v-avatar>
                      {{ item.patientName }}
                    </div>
                    <v-chip v-else size="small" color="grey" variant="tonal">
                      No patient
                    </v-chip>
                  </template>
                  
                  <template v-slot:item.status="{ item }">
                    <v-tooltip :text="getStatusTooltip(item)">
                      <template v-slot:activator="{ props }">
                        <v-chip
                          v-bind="props"
                          :color="getStatusColor(item)"
                          size="small"
                          variant="tonal"
                        >
                          {{ getStatusText(item) }}
                        </v-chip>
                      </template>
                    </v-tooltip>
                  </template>

                  <template v-slot:no-data>
                    <div class="d-flex flex-column align-center pa-4">
                      <v-icon icon="mdi-calendar-blank" size="64" color="grey" class="mb-2"></v-icon>
                      <div class="text-grey text-body-1">No past appointments found</div>
                    </div>
                  </template>
                </v-data-table>
              </v-window-item>
            </v-window>
          </v-card-text>
        </v-card>

        <!-- Notes Dialog -->
        <v-dialog v-model="showNotesDialog" max-width="500">
          <v-card>
            <v-card-title class="text-h5 pa-4">
              <v-icon icon="mdi-note-text" class="mr-2" color="primary"></v-icon>
              Add Confirmation Notes
            </v-card-title>
            
            <v-card-text>
              <v-textarea
                v-model="doctorNotes"
                label="Notes for Patient"
                rows="4"
                variant="outlined"
                placeholder="Add any special instructions or notes for the patient"
                class="mb-2"
              ></v-textarea>
              
              <v-alert
                type="info"
                variant="tonal"
                class="mb-0"
              >
                These notes will be visible to the patient after confirmation.
              </v-alert>
            </v-card-text>
            
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn
                color="grey-darken-1"
                variant="text"
                @click="showNotesDialog = false"
              >
                Cancel
              </v-btn>
              <v-btn
                color="success"
                variant="tonal"
                @click="() => {
                  updateAppointmentStatus(selectedAppointment, 'confirmed')
                }"
                :loading="loading"
              >
                Confirm Appointment
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <!-- Action Confirmation Dialog -->
        <v-dialog v-model="showActionDialog" max-width="500">
          <v-card>
            <v-card-title class="text-h5 pa-4">
              <v-icon 
                :icon="actionDialogType === 'delete' ? 'mdi-delete-alert' : 'mdi-cancel'" 
                class="mr-2" 
                :color="actionDialogType === 'delete' ? 'error' : 'warning'"
              ></v-icon>
              Confirm {{ actionDialogType === 'delete' ? 'Delete' : 'Cancel' }}
            </v-card-title>
            
            <v-card-text>
              <p class="text-body-1">
                Are you sure you want to {{ actionDialogType === 'delete' ? 'delete' : 'cancel' }} 
                this time slot?
              </p>
              
              <div v-if="selectedSlot" class="mt-4 pa-4 bg-grey-lighten-4 rounded-lg">
                <div class="d-flex align-center mb-2">
                  <v-icon icon="mdi-calendar" class="mr-2" color="primary"></v-icon>
                  <strong>Date:</strong>
                  <span class="ml-2">{{ selectedSlot.formattedDate }}</span>
                </div>
                <div class="d-flex align-center mb-2">
                  <v-icon icon="mdi-clock" class="mr-2" color="primary"></v-icon>
                  <strong>Time:</strong>
                  <span class="ml-2">{{ selectedSlot.formattedTime }}</span>
                </div>
                <div v-if="selectedSlot.patientName" class="d-flex align-center">
                  <v-icon icon="mdi-account" class="mr-2" color="primary"></v-icon>
                  <strong>Patient:</strong>
                  <span class="ml-2">{{ selectedSlot.patientName }}</span>
                </div>
              </div>

              <v-alert
                v-if="actionDialogType === 'delete'"
                type="warning"
                variant="tonal"
                class="mt-4"
              >
                This action cannot be undone. Any cancelled appointments for this slot will also be deleted.
              </v-alert>
            </v-card-text>
            
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn
                color="grey-darken-1"
                variant="text"
                @click="showActionDialog = false"
              >
                Cancel
              </v-btn>
              <v-btn
                :color="actionDialogType === 'delete' ? 'error' : 'warning'"
                variant="tonal"
                @click="handleActionConfirm"
                :loading="loading"
              >
                {{ actionDialogType === 'delete' ? 'Delete Slot' : 'Cancel Slot' }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-container>
    </template>
  </AppLayout>
</template>

<style scoped>
.v-card {
  margin-bottom: 20px;
  border-radius: 12px;
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
  border-radius: 8px;
}

.v-btn {
  text-transform: none;
  letter-spacing: 0.5px;
}

.v-btn--size-small {
  min-width: 96px;
}

.gap-2 {
  gap: 8px;
}

.v-card-title {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.v-date-picker {
  border-radius: 8px;
  overflow: hidden;
}

/* Add hover effects */
.v-btn:hover {
  transform: translateY(-1px);
  transition: transform 0.2s ease;
}

.v-chip {
  font-weight: 500;
}

/* Add responsive styles */
@media (max-width: 600px) {
  .v-card-title {
    flex-direction: column;
    align-items: stretch;
  }

  .v-card-title .v-text-field {
    margin-left: 0;
    margin-top: 12px;
    max-width: 100%;
  }

  .d-flex.justify-center.gap-2 {
    flex-direction: column;
  }

  .v-btn--size-small {
    width: 100%;
  }
}

/* Add transitions */
.v-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.v-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
}

/* Add custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #666;
}
</style> 