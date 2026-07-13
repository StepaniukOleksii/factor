import React, {useState} from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
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
import {
    FooterBar,
    LabeledTextField,
    PrimaryActionButton,
    ScreenContainer,
    ScreenHeader
} from "@presentation/components";
import {COLORS, RADIUS, TYPOGRAPHY} from "@presentation/theme";

// Create instances here for simplicity, typically would use DI.
const repository = new SQLiteObservationRepository();
const useCase = new CreateObservationUseCase(repository);

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
        <ScreenContainer>
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
                        <LabeledTextField
                            label="OBSERVATION NAME"
                            value={observationName}
                            onChangeText={setObservationName}
                            placeholder="e.g., Sleep Quality, Mood"
                            maxLength={OBSERVATION_NAME_MAX_LENGTH}
                            showCounter
                        />
                    </View>
                </View>

                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {/* Description Section */}
                    <View style={styles.descriptionSection}>
                        <LabeledTextField
                            label="DESCRIPTION"
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Optional — what does this observation track?"
                            multiline
                            numberOfLines={3}
                            maxLength={OBSERVATION_DESCRIPTION_MAX_LENGTH}
                            showCounter
                        />
                    </View>
                    <View style={styles.divider}/>
                    {/* Metrics Section */}
                    <View style={styles.metricsContainer}>
                        <Text style={styles.label}>METRICS</Text>

                        {metrics.map((metric, index) => (
                            <View key={index} style={styles.metricCard}>
                                <View style={styles.metricGrid}>
                                    <View style={styles.metricField}>
                                        <LabeledTextField
                                            label="METRIC NAME"
                                            labelAccessory={metrics.length > 1 ? (
                                                <TouchableOpacity onPress={() => handleRemoveMetric(index)}
                                                                  style={styles.deleteButton}>
                                                    <MaterialIcons name="delete" size={20} color={COLORS.outline}/>
                                                </TouchableOpacity>
                                            ) : undefined}
                                            value={metric.name}
                                            onChangeText={(val) => handleMetricChange(index, 'name', val)}
                                            placeholder="e.g., Duration"
                                            maxLength={METRIC_NAME_MAX_LENGTH}
                                            showCounter
                                        />
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
                <FooterBar>
                    <PrimaryActionButton label="Create Observation" onPress={handleSave}/>
                </FooterBar>

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
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
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
    label: {...TYPOGRAPHY.sectionCaption, marginBottom: 8},
    descriptionSection: {
        marginTop: 16,
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
        borderRadius: RADIUS.lg,
        padding: 16,
        marginBottom: 16,
    },
    metricGrid: {
        flexDirection: 'column',
        gap: 16,
    },
    metricField: {
        flex: 1,
    },
    // Label for the TYPE selector, which can't use LabeledTextField directly.
    metricLabel: {...TYPOGRAPHY.fieldLabel, marginBottom: 8},
    typeSelector: {
        backgroundColor: COLORS.surfaceContainerLowest,
        borderRadius: RADIUS.sm,
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
        borderRadius: RADIUS.md,
        gap: 8,
    },
    addMetricText: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.onSurfaceVariant,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: COLORS.surfaceContainerLow,
        width: '80%',
        borderRadius: RADIUS.md,
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
