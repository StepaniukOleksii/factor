import React, {useState} from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar as RNStatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import {CreateObservationUseCase} from '../../application/CreateObservationUseCase';
import {SQLiteObservationRepository} from '../../infrastructure/SQLiteObservationRepository';
import {MetricValueType} from '../../domain/Metric';
import {
    METRIC_NAME_MAX_LENGTH,
    OBSERVATION_DESCRIPTION_MAX_LENGTH,
    OBSERVATION_NAME_MAX_LENGTH,
} from '../../domain/validationLimits';
import {MaterialIcons} from '@expo/vector-icons';
import {PrimaryActionButton, ScreenHeader} from "@presentation/components";

// Create instances here for simplicity, typically would use DI.
const repository = new SQLiteObservationRepository();
const useCase = new CreateObservationUseCase(repository);

const COLORS = {
    background: '#131313',
    surface: '#131313',
    onSurface: '#e5e2e1',
    onSurfaceVariant: '#c2c9b9',
    surfaceContainerLowest: '#0e0e0e',
    surfaceContainerLow: '#1c1b1b',
    outlineVariant: '#42493d',
    outline: '#8c9385',
    primaryContainer: '#b6f09c',
    onPrimaryFixedVariant: '#205110',
    error: '#ffb4ab',
};

export interface CreateObservationScreenProps {
    onCreated?: () => void;
    onBack?: () => void;
}

export function CreateObservationScreen({onCreated, onBack}: CreateObservationScreenProps) {
    const [observationName, setObservationName] = useState('');
    const [description, setDescription] = useState('');
    const [metrics, setMetrics] = useState([{name: '', type: 'Numeric'}]);

    const [dropdownVisible, setDropdownVisible] = useState(false);
    const [activeMetricIndex, setActiveMetricIndex] = useState<number | null>(null);

    const handleAddMetric = () => {
        setMetrics([...metrics, {name: '', type: 'Numeric'}]);
    };

    const handleMetricChange = (index: number, key: 'name' | 'type', value: string) => {
        const newMetrics = [...metrics];
        newMetrics[index] = {...newMetrics[index], [key]: value};
        setMetrics(newMetrics);
    };

    const handleRemoveMetric = (index: number) => {
        const newMetrics = metrics.filter((_, i) => i !== index);
        setMetrics(newMetrics);
    };

    const handleSave = async () => {
        try {
            await useCase.execute({
                name: observationName,
                description: description.trim(),
                metrics: metrics.map(m => ({name: m.name, type: m.type as string}))
            });
            // Reset form
            setObservationName('');
            setDescription('');
            setMetrics([{name: '', type: 'Numeric'}]);
            if (onCreated) {
                onCreated();
            } else {
                Alert.alert('Success', 'Observation created successfully!');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'An error occurred while saving.');
        }
    };

    const openDropdown = (index: number) => {
        setActiveMetricIndex(index);
        setDropdownVisible(true);
    };

    const selectType = (type: MetricValueType) => {
        if (activeMetricIndex !== null) {
            handleMetricChange(activeMetricIndex, 'type', type);
        }
        setDropdownVisible(false);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

                <ScreenHeader
                    title="New Observation"
                    onBack={onBack}
                    rightAction={
                        <TouchableOpacity style={styles.iconButton}>
                            <MaterialIcons name="more-vert" size={24} color={COLORS.onSurface}/>
                        </TouchableOpacity>
                    }
                />
                {/* Sticky Top Section (Observation Name) */}
                <View style={styles.stickySection}>
                    <View style={styles.section}>
                        <Text style={styles.label}>OBSERVATION NAME</Text>
                        <TextInput
                            style={styles.input}
                            value={observationName}
                            onChangeText={setObservationName}
                            placeholder="e.g., Sleep Quality, Mood"
                            placeholderTextColor={COLORS.outline}
                            maxLength={OBSERVATION_NAME_MAX_LENGTH}
                        />
                        <Text style={styles.charCounter}>
                            {observationName.length}/{OBSERVATION_NAME_MAX_LENGTH}
                        </Text>
                    </View>
                </View>

                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {/* Description Section */}
                    <View style={styles.descriptionSection}>
                        <Text style={styles.label}>DESCRIPTION</Text>
                        <TextInput
                            style={styles.descriptionInput}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Optional — what does this observation track?"
                            placeholderTextColor={COLORS.outline}
                            multiline
                            numberOfLines={3}
                            maxLength={OBSERVATION_DESCRIPTION_MAX_LENGTH}
                            textAlignVertical="top"
                        />
                        <Text style={styles.charCounter}>
                            {description.length}/{OBSERVATION_DESCRIPTION_MAX_LENGTH}
                        </Text>
                    </View>
                    <View style={styles.divider}/>
                    {/* Metrics Section */}
                    <View style={styles.metricsContainer}>
                        <Text style={styles.label}>METRICS</Text>

                        {metrics.map((metric, index) => (
                            <View key={index} style={styles.metricCard}>
                                <View style={styles.metricGrid}>
                                    <View style={styles.metricField}>
                                        <View style={styles.metricLabelRow}>
                                            <Text style={styles.metricLabel}>METRIC NAME</Text>
                                            {metrics.length > 1 && (
                                                <TouchableOpacity onPress={() => handleRemoveMetric(index)}
                                                                  style={styles.deleteButton}>
                                                    <MaterialIcons name="delete" size={20} color={COLORS.outline}/>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        <TextInput
                                            style={styles.metricInput}
                                            value={metric.name}
                                            onChangeText={(val) => handleMetricChange(index, 'name', val)}
                                            placeholder="e.g., Duration"
                                            placeholderTextColor={COLORS.outline}
                                            maxLength={METRIC_NAME_MAX_LENGTH}
                                        />
                                        <Text style={styles.charCounter}>
                                            {metric.name.length}/{METRIC_NAME_MAX_LENGTH}
                                        </Text>
                                    </View>

                                    <View style={styles.metricField}>
                                        <Text style={styles.metricLabel}>TYPE</Text>
                                        <TouchableOpacity
                                            style={styles.typeSelector}
                                            onPress={() => openDropdown(index)}
                                        >
                                            <Text style={styles.typeText}>{metric.type}</Text>
                                            <MaterialIcons name="expand-more" size={20} color={COLORS.outline}/>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))}

                        <TouchableOpacity style={styles.addMetricButton} onPress={handleAddMetric}>
                            <MaterialIcons name="add" size={20} color={COLORS.onSurfaceVariant}/>
                            <Text style={styles.addMetricText}>Add Metric</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                {/* Fixed Footer */}
                <View style={styles.footer}>
                    <PrimaryActionButton label="Create Observation" onPress={handleSave}/>
                </View>

                {/* Dropdown Modal */}
                <Modal visible={dropdownVisible} transparent animationType="fade">
                    <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={styles.modalContent}>
                                    {['Numeric', 'Text', 'Boolean'].map(type => (
                                        <TouchableOpacity
                                            key={type}
                                            style={styles.modalOption}
                                            onPress={() => selectType(type as MetricValueType)}
                                        >
                                            <Text style={styles.modalOptionText}>{type}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
    },
    container: {
        flex: 1,
    },
    iconButton: {
        padding: 8,
    },
    stickySection: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.outlineVariant,
        backgroundColor: COLORS.background,
        zIndex: 10,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 100, // Make room for fixed footer
    },
    section: {
        marginBottom: 0,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.onSurfaceVariant,
        letterSpacing: 1.2,
        marginBottom: 8,
    },
    input: {
        backgroundColor: COLORS.surfaceContainerLowest,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: COLORS.onSurface,
        fontSize: 16,
    },
    descriptionSection: {
        marginTop: 16,
    },
    descriptionInput: {
        backgroundColor: COLORS.surfaceContainerLowest,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: COLORS.onSurface,
        fontSize: 16,
        minHeight: 72,
    },
    charCounter: {
        fontSize: 12,
        color: COLORS.outline,
        alignSelf: 'flex-end',
        marginTop: 4,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.outlineVariant,
        marginVertical: 16,
    },
    metricsContainer: {
        gap: 16,
    },
    metricCard: {
        backgroundColor: COLORS.surfaceContainerLow,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
    },
    metricGrid: {
        flexDirection: 'column',
        gap: 16,
    },
    metricField: {
        flex: 1,
        gap: 4,
    },
    metricLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    metricLabel: {
        fontSize: 12,
        color: COLORS.outline,
    },
    metricInput: {
        backgroundColor: COLORS.surfaceContainerLowest,
        borderWidth: 1,
        borderColor: 'transparent',
        borderRadius: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        color: COLORS.onSurface,
        fontSize: 16,
    },
    typeSelector: {
        backgroundColor: COLORS.surfaceContainerLowest,
        borderRadius: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 44, // Match input height roughly
    },
    typeText: {
        color: COLORS.onSurface,
        fontSize: 16,
    },
    deleteButton: {
        padding: 4,
        marginRight: -4,
    },
    addMetricButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: COLORS.outlineVariant,
        borderRadius: 8,
        gap: 8,
    },
    addMetricText: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.onSurfaceVariant,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(19, 19, 19, 0.8)',
        borderTopWidth: 1,
        borderTopColor: COLORS.outlineVariant,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'android' ? 40 : 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: COLORS.surfaceContainerLow,
        width: '80%',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        paddingVertical: 8,
    },
    modalOption: {
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    modalOptionText: {
        color: COLORS.onSurface,
        fontSize: 16,
    },
});
