#ifndef THINKING_H
#define THINKING_H

#include <string>
#include <vector>
#include <memory>
#include <functional>
#include <chrono>
#include <mutex>
#include <atomic>
#include <unordered_map>
#include <map>
#include <set>
#include <queue>
#include <deque>
#include <list>
#include <stack>
#include <array>
#include <tuple>
#include <variant>
#include <optional>
#include <any>
#include <fstream>
#include <sstream>
#include <iostream>
#include <thread>
#include <condition_variable>
#include <future>
#include <algorithm>
#include <regex>
#include <random>
#include <ctime>
#include <iomanip>
#include <exception>
#include <stdexcept>
#include <system_error>
#include <type_traits>
#include <utility>
#include <limits>
#include <bitset>
#include <cstdint>

namespace nexus {
namespace thinking {

// ============================================================================
// Exception Classes
// ============================================================================

class ThinkingException : public std::runtime_error {
public:
    explicit ThinkingException(const std::string& message) : std::runtime_error(message) {}
    virtual ~ThinkingException() = default;
};

class SessionNotFoundException : public ThinkingException {
public:
    explicit SessionNotFoundException(const std::string& sessionId)
        : ThinkingException("Session not found: " + sessionId) {}
};

class StepNotFoundException : public ThinkingException {
public:
    explicit StepNotFoundException(const std::string& stepId)
        : ThinkingException("Step not found: " + stepId) {}
};

class InvalidStateException : public ThinkingException {
public:
    explicit InvalidStateException(const std::string& state)
        : ThinkingException("Invalid state: " + state) {}
};

class SerializationException : public ThinkingException {
public:
    explicit SerializationException(const std::string& message)
        : ThinkingException("Serialization error: " + message) {}
};

class ConfigurationException : public ThinkingException {
public:
    explicit ConfigurationException(const std::string& message)
        : ThinkingException("Configuration error: " + message) {}
};

class PersistenceException : public ThinkingException {
public:
    explicit PersistenceException(const std::string& message)
        : ThinkingException("Persistence error: " + message) {}
};

class NetworkException : public ThinkingException {
public:
    explicit NetworkException(const std::string& message)
        : ThinkingException("Network error: " + message) {}
};

class ValidationException : public ThinkingException {
public:
    explicit ValidationException(const std::string& message)
        : ThinkingException("Validation error: " + message) {}
};

// ============================================================================
// Enums and Constants
// ============================================================================

// Enum for thinking step status
enum class StepStatus {
    PENDING,
    ACTIVE,
    DONE,
    FAILED,
    CANCELLED,
    SKIPPED
};

// Enum for thinking state
enum class ThinkingState {
    IDLE,
    THINKING,
    PAUSED,
    COMPLETED,
    ERROR,
    CANCELLED,
    TIMEOUT
};

// Enum for log levels
enum class LogLevel {
    TRACE,
    DEBUG,
    INFO,
    WARNING,
    ERROR,
    CRITICAL,
    OFF
};

// Enum for cache eviction policy
enum class CacheEvictionPolicy {
    LRU,
    LFU,
    FIFO,
    LIFO,
    RANDOM
};

// Enum for persistence backend
enum class PersistenceBackend {
    MEMORY,
    FILE,
    SQLITE,
    MYSQL,
    POSTGRESQL,
    MONGODB,
    REDIS
};

// Enum for serialization format
enum class SerializationFormat {
    JSON,
    BINARY,
    XML,
    YAML,
    PROTOBUF,
    MSGPACK
};

// Enum for event priority
enum class EventPriority {
    LOW,
    NORMAL,
    HIGH,
    CRITICAL
};

// Constants
constexpr int DEFAULT_MAX_CONCURRENT_SESSIONS = 10;
constexpr int DEFAULT_PROCESSING_TIMEOUT_MS = 30000;
constexpr int DEFAULT_CACHE_SIZE = 1000;
constexpr int DEFAULT_CACHE_TTL_MS = 60000;
constexpr int DEFAULT_SESSION_CLEANUP_INTERVAL_MS = 300000;
constexpr size_t MAX_BINARY_SERIALIZATION_SIZE = 10 * 1024 * 1024; // 10MB

// ============================================================================
// Core Data Structures
// ============================================================================

// Thinking step data structure (extended)
struct ThinkingStep {
    std::string id;
    std::string label;
    StepStatus status;
    std::chrono::system_clock::time_point startTime;
    std::chrono::system_clock::time_point endTime;
    std::string errorMessage;
    int order;
    std::string description;
    std::map<std::string, std::string> metadata;
    std::string parentId;
    std::vector<std::string> childIds;
    double progress;
    int retryCount;
    int maxRetries;
    std::string category;
    int priority;
    std::chrono::system_clock::time_point deadline;
    bool isCritical;
    std::string assignedTo;
    std::vector<std::string> tags;
    std::string outputData;
    std::string inputData;

    ThinkingStep() 
        : status(StepStatus::PENDING), 
          order(0), 
          progress(0.0), 
          retryCount(0), 
          maxRetries(3),
          priority(0),
          isCritical(false) {}
    
    ThinkingStep(const std::string& id, const std::string& label, int order = 0)
        : id(id), 
          label(label), 
          status(StepStatus::PENDING), 
          order(order),
          progress(0.0),
          retryCount(0),
          maxRetries(3),
          priority(0),
          isCritical(false) {
        startTime = std::chrono::system_clock::now();
    }

    double getDurationMs() const {
        auto end = (status == StepStatus::DONE || status == StepStatus::FAILED || 
                   status == StepStatus::CANCELLED || status == StepStatus::SKIPPED) 
                   ? endTime 
                   : std::chrono::system_clock::now();
        return std::chrono::duration<double, std::milli>(end - startTime).count();
    }

    bool canRetry() const {
        return retryCount < maxRetries && status == StepStatus::FAILED;
    }

    void incrementRetry() {
        retryCount++;
        status = StepStatus::PENDING;
        startTime = std::chrono::system_clock::now();
    }

    bool isOverdue() const {
        if (deadline == std::chrono::system_clock::time_point{}) {
            return false;
        }
        return std::chrono::system_clock::now() > deadline;
    }

    double getEstimatedRemainingTimeMs() const {
        if (progress <= 0.0) return 0.0;
        if (progress >= 1.0) return 0.0;
        double elapsed = getDurationMs();
        return (elapsed / progress) - elapsed;
    }
};

// Thinking session data structure (extended)
struct ThinkingSession {
    std::string id;
    std::string messageId;
    std::vector<ThinkingStep> steps;
    ThinkingState state;
    std::chrono::system_clock::time_point startTime;
    std::chrono::system_clock::time_point endTime;
    std::string errorMessage;
    std::string userId;
    std::string context;
    std::map<std::string, std::string> metadata;
    std::string model;
    std::string version;
    double temperature;
    int maxTokens;
    std::vector<std::string> tags;
    std::string parentSessionId;
    std::vector<std::string> childSessionIds;
    std::chrono::system_clock::time_point deadline;
    int priority;
    bool isPersistent;
    std::string persistenceKey;
    std::vector<std::string> dependencies;
    std::map<std::string, double> metrics;
    std::string callbackUrl;
    std::map<std::string, std::string> headers;
    std::string webhookUrl;
    int retryCount;
    int maxRetries;
    std::string correlationId;
    std::string requestId;
    std::string traceId;

    ThinkingSession() 
        : state(ThinkingState::IDLE),
          temperature(0.7),
          maxTokens(2048),
          priority(0),
          isPersistent(false),
          retryCount(0),
          maxRetries(3) {
        startTime = std::chrono::system_clock::now();
    }

    double getTotalDurationMs() const {
        auto end = (state == ThinkingState::COMPLETED || state == ThinkingState::ERROR || 
                   state == ThinkingState::CANCELLED || state == ThinkingState::TIMEOUT) 
                   ? endTime 
                   : std::chrono::system_clock::now();
        return std::chrono::duration<double, std::milli>(end - startTime).count();
    }

    int getCompletedSteps() const {
        return std::count_if(steps.begin(), steps.end(), 
            [](const ThinkingStep& step) { return step.status == StepStatus::DONE; });
    }

    int getFailedSteps() const {
        return std::count_if(steps.begin(), steps.end(), 
            [](const ThinkingStep& step) { return step.status == StepStatus::FAILED; });
    }

    int getActiveSteps() const {
        return std::count_if(steps.begin(), steps.end(), 
            [](const ThinkingStep& step) { return step.status == StepStatus::ACTIVE; });
    }

    int getTotalSteps() const {
        return steps.size();
    }

    double getProgress() const {
        if (steps.empty()) return 0.0;
        return static_cast<double>(getCompletedSteps()) / steps.size();
    }

    double getSuccessRate() const {
        if (steps.empty()) return 0.0;
        return static_cast<double>(getCompletedSteps()) / steps.size();
    }

    bool isOverdue() const {
        if (deadline == std::chrono::system_clock::time_point{}) {
            return false;
        }
        return std::chrono::system_clock::now() > deadline;
    }

    bool canRetry() const {
        return retryCount < maxRetries && 
               (state == ThinkingState::ERROR || state == ThinkingState::TIMEOUT);
    }

    void incrementRetry() {
        retryCount++;
        state = ThinkingState::IDLE;
        startTime = std::chrono::system_clock::now();
        for (auto& step : steps) {
            if (step.status == StepStatus::FAILED) {
                step.incrementRetry();
            }
        }
    }

    std::vector<ThinkingStep*> getStepsByCategory(const std::string& category) {
        std::vector<ThinkingStep*> result;
        for (auto& step : steps) {
            if (step.category == category) {
                result.push_back(&step);
            }
        }
        return result;
    }

    std::vector<ThinkingStep*> getStepsByPriority(int minPriority) {
        std::vector<ThinkingStep*> result;
        for (auto& step : steps) {
            if (step.priority >= minPriority) {
                result.push_back(&step);
            }
        }
        return result;
    }

    std::vector<ThinkingStep*> getCriticalSteps() {
        std::vector<ThinkingStep*> result;
        for (auto& step : steps) {
            if (step.isCritical) {
                result.push_back(&step);
            }
        }
        return result;
    }

    std::vector<ThinkingStep*> getOverdueSteps() {
        std::vector<ThinkingStep*> result;
        for (auto& step : steps) {
            if (step.isOverdue()) {
                result.push_back(&step);
            }
        }
        return result;
    }

    void addMetric(const std::string& key, double value) {
        metrics[key] = value;
    }

    double getMetric(const std::string& key, double defaultValue = 0.0) const {
        auto it = metrics.find(key);
        return (it != metrics.end()) ? it->second : defaultValue;
    }

    bool hasTag(const std::string& tag) const {
        return std::find(tags.begin(), tags.end(), tag) != tags.end();
    }

    void addTag(const std::string& tag) {
        if (!hasTag(tag)) {
            tags.push_back(tag);
        }
    }

    void removeTag(const std::string& tag) {
        tags.erase(std::remove(tags.begin(), tags.end(), tag), tags.end());
    }
};

// Callback types (extended)
using StepCallback = std::function<void(const ThinkingStep&)>;
using SessionCallback = std::function<void(const ThinkingSession&)>;
using ProgressCallback = std::function<void(double)>;
using ErrorCallback = std::function<void(const std::string&, const std::string&)>;
using CompletionCallback = std::function<void(bool, const std::string&)>;
using MetricCallback = std::function<void(const std::string&, double)>;
using EventCallback = std::function<void(const std::string&, const std::any&)>;

// ============================================================================
// Logging System
// ============================================================================

struct LogEntry {
    std::chrono::system_clock::time_point timestamp;
    LogLevel level;
    std::string message;
    std::string category;
    std::string source;
    std::thread::id threadId;
    std::map<std::string, std::string> context;
};

class Logger {
public:
    static Logger& getInstance();
    
    void setLogLevel(LogLevel level);
    LogLevel getLogLevel() const;
    
    void log(LogLevel level, const std::string& message, const std::string& category = "");
    void trace(const std::string& message, const std::string& category = "");
    void debug(const std::string& message, const std::string& category = "");
    void info(const std::string& message, const std::string& category = "");
    void warning(const std::string& message, const std::string& category = "");
    void error(const std::string& message, const std::string& category = "");
    void critical(const std::string& message, const std::string& category = "");
    
    void addContext(const std::string& key, const std::string& value);
    void removeContext(const std::string& key);
    void clearContext();
    
    void setOutputFile(const std::string& filename);
    void enableConsoleOutput(bool enable);
    void enableFileOutput(bool enable);
    
    std::vector<LogEntry> getEntries(LogLevel minLevel = LogLevel::TRACE) const;
    std::vector<LogEntry> getEntriesByCategory(const std::string& category) const;
    void clearEntries();
    
private:
    Logger();
    ~Logger();
    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;
    
    void writeLog(const LogEntry& entry);
    std::string formatLogEntry(const LogEntry& entry) const;
    std::string levelToString(LogLevel level) const;
    
    LogLevel minLevel_;
    bool consoleOutput_;
    bool fileOutput_;
    std::ofstream outputFile_;
    std::vector<LogEntry> entries_;
    std::map<std::string, std::string> context_;
    mutable std::mutex mutex_;
};

// ============================================================================
// Configuration Management System
// ============================================================================

class Configuration {
public:
    static Configuration& getInstance();
    
    void loadFromFile(const std::string& filename);
    void saveToFile(const std::string& filename) const;
    void loadFromString(const std::string& json);
    std::string saveToString() const;
    
    void set(const std::string& key, const std::string& value);
    void set(const std::string& key, int value);
    void set(const std::string& key, double value);
    void set(const std::string& key, bool value);
    
    std::string getString(const std::string& key, const std::string& defaultValue = "") const;
    int getInt(const std::string& key, int defaultValue = 0) const;
    double getDouble(const std::string& key, double defaultValue = 0.0) const;
    bool getBool(const std::string& key, bool defaultValue = false) const;
    
    bool has(const std::string& key) const;
    void remove(const std::string& key);
    void clear();
    
    std::vector<std::string> getKeys() const;
    std::vector<std::string> getKeysWithPrefix(const std::string& prefix) const;
    
    void setDefaults(const std::map<std::string, std::string>& defaults);
    void validate(const std::vector<std::string>& requiredKeys) const;
    
private:
    Configuration() = default;
    std::map<std::string, std::string> config_;
    mutable std::mutex mutex_;
};

// ============================================================================
// Thread Pool
// ============================================================================

class ThreadPool {
public:
    explicit ThreadPool(size_t numThreads = std::thread::hardware_concurrency());
    ~ThreadPool();
    
    template<typename F, typename... Args>
    auto enqueue(F&& f, Args&&... args) -> std::future<typename std::result_of<F(Args...)>::type>;
    
    void resize(size_t numThreads);
    size_t size() const;
    size_t idleCount() const;
    void waitForAll();
    void clear();
    
    void setMaxQueueSize(size_t maxSize);
    size_t getMaxQueueSize() const;
    size_t getQueueSize() const;
    
private:
    void workerThread();
    
    std::vector<std::thread> workers_;
    std::queue<std::function<void()>> tasks_;
    std::mutex queueMutex_;
    std::condition_variable condition_;
    std::condition_variable finished_;
    bool stop_;
    size_t maxQueueSize_;
    std::atomic<size_t> activeWorkers_;
};

template<typename F, typename... Args>
auto ThreadPool::enqueue(F&& f, Args&&... args) -> std::future<typename std::result_of<F(Args...)>::type> {
    using ReturnType = typename std::result_of<F(Args...)>::type;
    
    auto task = std::make_shared<std::packaged_task<ReturnType()>>(
        std::bind(std::forward<F>(f), std::forward<Args>(args)...)
    );
    
    std::future<ReturnType> result = task->get_future();
    
    {
        std::unique_lock<std::mutex> lock(queueMutex_);
        
        if (stop_) {
            throw std::runtime_error("ThreadPool is stopped");
        }
        
        if (maxQueueSize_ > 0 && tasks_.size() >= maxQueueSize_) {
            throw std::runtime_error("ThreadPool queue is full");
        }
        
        tasks_.emplace([task]() { (*task)(); });
    }
    
    condition_.notify_one();
    return result;
}

// ============================================================================
// Caching System
// ============================================================================

template<typename Key, typename Value>
class CacheEntry {
public:
    Value value;
    std::chrono::system_clock::time_point createdAt;
    std::chrono::system_clock::time_point lastAccessed;
    size_t accessCount;
    std::chrono::milliseconds ttl;
    
    CacheEntry(const Value& v, std::chrono::milliseconds ttl)
        : value(v), ttl(ttl), accessCount(0) {
        createdAt = std::chrono::system_clock::now();
        lastAccessed = createdAt;
    }
    
    bool isExpired() const {
        if (ttl.count() == 0) return false;
        auto now = std::chrono::system_clock::now();
        return (now - createdAt) >= ttl;
    }
    
    void access() {
        lastAccessed = std::chrono::system_clock::now();
        accessCount++;
    }
};

template<typename Key, typename Value>
class Cache {
public:
    explicit Cache(size_t maxSize = DEFAULT_CACHE_SIZE, 
                  CacheEvictionPolicy policy = CacheEvictionPolicy::LRU,
                  std::chrono::milliseconds defaultTtl = std::chrono::milliseconds(DEFAULT_CACHE_TTL_MS));
    
    void put(const Key& key, const Value& value, std::chrono::milliseconds ttl = std::chrono::milliseconds(0));
    std::optional<Value> get(const Key& key);
    bool has(const Key& key) const;
    void remove(const Key& key);
    void clear();
    
    void setMaxSize(size_t maxSize);
    void setEvictionPolicy(CacheEvictionPolicy policy);
    void setDefaultTtl(std::chrono::milliseconds ttl);
    
    size_t size() const;
    size_t getMaxSize() const;
    double hitRate() const;
    size_t hitCount() const;
    size_t missCount() const;
    
    void cleanupExpired();
    std::vector<Key> getKeys() const;
    
private:
    void evictIfNeeded();
    Key selectKeyToEvict() const;
    
    std::unordered_map<Key, CacheEntry<Key, Value>> cache_;
    size_t maxSize_;
    CacheEvictionPolicy evictionPolicy_;
    std::chrono::milliseconds defaultTtl_;
    mutable std::shared_mutex mutex_;
    std::atomic<size_t> hitCount_;
    std::atomic<size_t> missCount_;
};

// ============================================================================
// Event System
// ============================================================================

struct Event {
    std::string type;
    std::any data;
    EventPriority priority;
    std::chrono::system_clock::time_point timestamp;
    std::string source;
    std::string correlationId;
    
    Event(const std::string& type, std::any data, EventPriority priority = EventPriority::NORMAL)
        : type(type), data(data), priority(priority) {
        timestamp = std::chrono::system_clock::now();
    }
};

class EventBus {
public:
    static EventBus& getInstance();
    
    using SubscriptionId = size_t;
    
    SubscriptionId subscribe(const std::string& eventType, EventCallback callback, 
                           EventPriority minPriority = EventPriority::LOW);
    void unsubscribe(SubscriptionId subscriptionId);
    void unsubscribeAll(const std::string& eventType);
    
    void publish(const Event& event);
    void publishAsync(const Event& event);
    
    void setMaxQueueSize(size_t maxSize);
    void processQueue();
    void clearQueue();
    
    size_t getSubscriberCount(const std::string& eventType) const;
    size_t getQueueSize() const;
    
private:
    EventBus() = default;
    
    struct Subscription {
        SubscriptionId id;
        EventCallback callback;
        EventPriority minPriority;
        std::string eventType;
    };
    
    std::unordered_map<std::string, std::vector<Subscription>> subscriptions_;
    std::queue<Event> eventQueue_;
    std::mutex mutex_;
    size_t maxQueueSize_;
    std::atomic<SubscriptionId> nextSubscriptionId_;
};

// ============================================================================
// Statistics and Analytics
// ============================================================================

class Statistics {
public:
    static Statistics& getInstance();
    
    void incrementCounter(const std::string& key, double delta = 1.0);
    void setGauge(const std::string& key, double value);
    void recordTiming(const std::string& key, double durationMs);
    void recordHistogram(const std::string& key, double value);
    
    double getCounter(const std::string& key) const;
    double getGauge(const std::string& key) const;
    double getTimingAverage(const std::string& key) const;
    double getTimingPercentile(const std::string& key, double percentile) const;
    double getHistogramCount(const std::string& key) const;
    double getHistogramAverage(const std::string& key) const;
    
    void resetCounter(const std::string& key);
    void resetGauge(const std::string& key);
    void resetTiming(const std::string& key);
    void resetHistogram(const std::string& key);
    void resetAll();
    
    std::vector<std::string> getCounterKeys() const;
    std::vector<std::string> getGaugeKeys() const;
    std::vector<std::string> getTimingKeys() const;
    std::vector<std::string> getHistogramKeys() const;
    
    std::string generateReport() const;
    void exportToJson(const std::string& filename) const;
    
private:
    Statistics() = default;
    
    std::unordered_map<std::string, double> counters_;
    std::unordered_map<std::string, double> gauges_;
    std::unordered_map<std::string, std::vector<double>> timings_;
    std::unordered_map<std::string, std::vector<double>> histograms_;
    mutable std::mutex mutex_;
};

// ============================================================================
// Validation Utilities
// ============================================================================

class Validator {
public:
    static bool isValidId(const std::string& id);
    static bool isValidEmail(const std::string& email);
    static bool isValidUrl(const std::string& url);
    static bool isValidJson(const std::string& json);
    
    static void validateId(const std::string& id);
    static void validateEmail(const std::string& email);
    static void validateUrl(const std::string& url);
    static void validateJson(const std::string& json);
    
    static std::string sanitizeString(const std::string& input);
    static std::string sanitizeHtml(const std::string& input);
    static std::string sanitizeSql(const std::string& input);
    
    static bool isNumeric(const std::string& str);
    static bool isAlpha(const std::string& str);
    static bool isAlphanumeric(const std::string& str);
    
    static std::string truncate(const std::string& str, size_t maxLength);
    static std::string normalizeWhitespace(const std::string& str);
    
private:
    static const std::regex ID_PATTERN;
    static const std::regex EMAIL_PATTERN;
    static const std::regex URL_PATTERN;
};

// ============================================================================
// Binary Serialization
// ============================================================================

class BinarySerializer {
public:
    BinarySerializer();
    ~BinarySerializer();
    
    void writeInt8(int8_t value);
    void writeInt16(int16_t value);
    void writeInt32(int32_t value);
    void writeInt64(int64_t value);
    void writeUInt8(uint8_t value);
    void writeUInt16(uint16_t value);
    void writeUInt32(uint32_t value);
    void writeUInt64(uint64_t value);
    void writeFloat(float value);
    void writeDouble(double value);
    void writeBool(bool value);
    void writeString(const std::string& value);
    void writeBytes(const std::vector<uint8_t>& value);
    
    int8_t readInt8();
    int16_t readInt16();
    int32_t readInt32();
    int64_t readInt64();
    uint8_t readUInt8();
    uint16_t readUInt16();
    uint32_t readUInt32();
    uint64_t readUInt64();
    float readFloat();
    double readDouble();
    bool readBool();
    std::string readString();
    std::vector<uint8_t> readBytes();
    
    std::vector<uint8_t> getData() const;
    void setData(const std::vector<uint8_t>& data);
    void clear();
    size_t size() const;
    
    void writeToFile(const std::string& filename) const;
    void readFromFile(const std::string& filename);
    
private:
    std::vector<uint8_t> buffer_;
    size_t position_;
};

// ============================================================================
// Persistence Layer
// ============================================================================

class PersistenceManager {
public:
    static PersistenceManager& getInstance();
    
    void setBackend(PersistenceBackend backend);
    PersistenceBackend getBackend() const;
    
    void setConnectionString(const std::string& connectionString);
    std::string getConnectionString() const;
    
    bool connect();
    void disconnect();
    bool isConnected() const;
    
    bool saveSession(const ThinkingSession& session);
    bool loadSession(const std::string& sessionId, ThinkingSession& session);
    bool deleteSession(const std::string& sessionId);
    bool sessionExists(const std::string& sessionId) const;
    
    std::vector<std::string> getAllSessionIds() const;
    std::vector<ThinkingSession> loadAllSessions() const;
    std::vector<ThinkingSession> loadSessionsByUserId(const std::string& userId) const;
    std::vector<ThinkingSession> loadSessionsByDateRange(
        const std::chrono::system_clock::time_point& start,
        const std::chrono::system_clock::time_point& end) const;
    
    bool saveMetadata(const std::string& key, const std::string& value);
    bool loadMetadata(const std::string& key, std::string& value);
    bool deleteMetadata(const std::string& key);
    
    void beginTransaction();
    void commitTransaction();
    void rollbackTransaction();
    
    void setMaxConnections(int maxConnections);
    void setConnectionTimeout(int timeoutMs);
    
private:
    PersistenceManager() = default;
    
    PersistenceBackend backend_;
    std::string connectionString_;
    bool connected_;
    int maxConnections_;
    int connectionTimeout_;
    mutable std::mutex mutex_;
    
    bool saveSessionToFile(const ThinkingSession& session);
    bool loadSessionFromFile(const std::string& sessionId, ThinkingSession& session);
    bool deleteSessionFromFile(const std::string& sessionId);
    bool sessionExistsInFile(const std::string& sessionId) const;
    
    bool saveSessionToMemory(const ThinkingSession& session);
    bool loadSessionFromMemory(const std::string& sessionId, ThinkingSession& session);
    bool deleteSessionFromMemory(const std::string& sessionId);
    
    std::unordered_map<std::string, ThinkingSession> memoryStorage_;
};

// ============================================================================
// Profiling and Performance Monitoring
// ============================================================================

class Profiler {
public:
    class ScopedTimer {
    public:
        explicit ScopedTimer(const std::string& name);
        ~ScopedTimer();
        
        void stop();
        double getElapsedMs() const;
        
    private:
        std::string name_;
        std::chrono::high_resolution_clock::time_point startTime_;
        std::chrono::high_resolution_clock::time_point endTime_;
        bool stopped_;
    };
    
    static Profiler& getInstance();
    
    void startTiming(const std::string& name);
    void stopTiming(const std::string& name);
    void recordTiming(const std::string& name, double durationMs);
    
    double getTiming(const std::string& name) const;
    double getAverageTiming(const std::string& name) const;
    double getMinTiming(const std::string& name) const;
    double getMaxTiming(const std::string& name) const;
    size_t getTimingCount(const std::string& name) const;
    
    void incrementCounter(const std::string& name, int64_t delta = 1);
    int64_t getCounter(const std::string& name) const;
    
    void setMemoryMarker(const std::string& name);
    size_t getMemoryUsage() const;
    size_t getMemoryDelta(const std::string& marker) const;
    
    void reset();
    void resetTiming(const std::string& name);
    void resetCounter(const std::string& name);
    
    std::string generateReport() const;
    void exportToJson(const std::string& filename) const;
    
private:
    Profiler() = default;
    
    struct TimingData {
        std::vector<double> samples;
        double total;
        double min;
        double max;
    };
    
    std::unordered_map<std::string, TimingData> timings_;
    std::unordered_map<std::string, int64_t> counters_;
    std::unordered_map<std::string, size_t> memoryMarkers_;
    mutable std::mutex mutex_;
};

// ============================================================================
// Internationalization Support
// ============================================================================

class I18n {
public:
    static I18n& getInstance();
    
    void setLocale(const std::string& locale);
    std::string getLocale() const;
    
    void loadTranslations(const std::string& filename);
    void loadTranslationsFromString(const std::string& json);
    void addTranslation(const std::string& key, const std::string& value);
    
    std::string translate(const std::string& key) const;
    std::string translate(const std::string& key, const std::map<std::string, std::string>& placeholders) const;
    
    bool hasTranslation(const std::string& key) const;
    std::vector<std::string> getAvailableKeys() const;
    
    void setFallbackLocale(const std::string& locale);
    
private:
    I18n() = default;
    
    std::string currentLocale_;
    std::string fallbackLocale_;
    std::unordered_map<std::string, std::unordered_map<std::string, std::string>> translations_;
    mutable std::mutex mutex_;
};

// ============================================================================
// Plugin System
// ============================================================================

class Plugin {
public:
    virtual ~Plugin() = default;
    virtual std::string getName() const = 0;
    virtual std::string getVersion() const = 0;
    virtual bool initialize() = 0;
    virtual void shutdown() = 0;
    virtual void onSessionCreated(const ThinkingSession& session) {}
    virtual void onSessionUpdated(const ThinkingSession& session) {}
    virtual void onSessionDeleted(const std::string& sessionId) {}
    virtual void onStepCreated(const ThinkingStep& step) {}
    virtual void onStepUpdated(const ThinkingStep& step) {}
};

class PluginManager {
public:
    static PluginManager& getInstance();
    
    bool registerPlugin(std::shared_ptr<Plugin> plugin);
    bool unregisterPlugin(const std::string& name);
    std::shared_ptr<Plugin> getPlugin(const std::string& name) const;
    std::vector<std::string> getPluginNames() const;
    
    bool loadPlugin(const std::string& path);
    bool unloadPlugin(const std::string& name);
    
    void initializeAll();
    void shutdownAll();
    
    void notifySessionCreated(const ThinkingSession& session);
    void notifySessionUpdated(const ThinkingSession& session);
    void notifySessionDeleted(const std::string& sessionId);
    void notifyStepCreated(const ThinkingStep& step);
    void notifyStepUpdated(const ThinkingStep& step);
    
private:
    PluginManager() = default;
    
    std::unordered_map<std::string, std::shared_ptr<Plugin>> plugins_;
    mutable std::mutex mutex_;
};

// ============================================================================
// Network Communication Layer
// ============================================================================

class HttpClient {
public:
    static HttpClient& getInstance();
    
    void setBaseUrl(const std::string& baseUrl);
    std::string getBaseUrl() const;
    
    void setDefaultHeaders(const std::map<std::string, std::string>& headers);
    void addHeader(const std::string& key, const std::string& value);
    void removeHeader(const std::string& key);
    void clearHeaders();
    
    void setTimeout(int timeoutMs);
    int getTimeout() const;
    
    std::string get(const std::string& path);
    std::string post(const std::string& path, const std::string& body);
    std::string put(const std::string& path, const std::string& body);
    std::string delete_(const std::string& path);
    
    void setAuthentication(const std::string& type, const std::string& credentials);
    void clearAuthentication();
    
private:
    HttpClient() = default;
    
    std::string baseUrl_;
    std::map<std::string, std::string> headers_;
    int timeout_;
    std::string authType_;
    std::string authCredentials_;
    mutable std::mutex mutex_;
};

// ============================================================================
// Unit Test Framework
// ============================================================================

class TestCase {
public:
    std::string name;
    std::function<void()> testFunc;
    bool passed;
    std::string errorMessage;
    double durationMs;
    
    TestCase(const std::string& name, std::function<void()> testFunc)
        : name(name), testFunc(testFunc), passed(false), durationMs(0.0) {}
};

class TestSuite {
public:
    static TestSuite& getInstance();
    
    void addTest(const std::string& name, std::function<void()> testFunc);
    void addTestSuite(const std::string& name, std::function<void()> setupFunc);
    
    void runAll();
    void runTest(const std::string& name);
    void runSuite(const std::string& name);
    
    void setUp();
    void tearDown();
    
    void assertEqual(int expected, int actual, const std::string& message = "");
    void assertNotEqual(int expected, int actual, const std::string& message = "");
    void assertTrue(bool condition, const std::string& message = "");
    void assertFalse(bool condition, const std::string& message = "");
    void assertNull(const void* ptr, const std::string& message = "");
    void assertNotNull(const void* ptr, const std::string& message = "");
    void assertThrows(std::function<void()> func, const std::string& message = "");
    
    void generateReport(const std::string& format = "text");
    void exportResults(const std::string& filename);
    
    int getPassedCount() const;
    int getFailedCount() const;
    double getTotalDurationMs() const;
    
private:
    TestSuite() = default;
    
    std::vector<TestCase> tests_;
    std::function<void()> setupFunc_;
    std::function<void()> teardownFunc_;
    mutable std::mutex mutex_;
};

// ============================================================================
// Original Core Classes (Enhanced)
// ============================================================================

// ThinkingStepManager class - manages individual thinking steps
class ThinkingStepManager {
public:
    ThinkingStepManager(const std::string& id, const std::string& label, int order = 0);
    ~ThinkingStepManager() = default;

    // Status management
    void setActive();
    void setDone();
    void setFailed(const std::string& error);
    void setCancelled();
    void setSkipped();
    void setProgress(double progress);
    StepStatus getStatus() const { return step_.status; }
    
    // Getters
    std::string getId() const { return step_.id; }
    std::string getLabel() const { return step_.label; }
    std::string getDescription() const { return step_.description; }
    void setDescription(const std::string& description) { step_.description = description; }
    double getDurationMs() const { return step_.getDurationMs(); }
    ThinkingStep getStep() const { return step_; }
    double getProgress() const { return step_.progress; }
    int getRetryCount() const { return step_.retryCount; }
    int getMaxRetries() const { return step_.maxRetries; }
    void setMaxRetries(int max) { step_.maxRetries = max; }
    
    // Metadata management
    void setMetadata(const std::string& key, const std::string& value);
    std::string getMetadata(const std::string& key, const std::string& defaultValue = "") const;
    void removeMetadata(const std::string& key);
    std::vector<std::string> getMetadataKeys() const;
    
    // Parent-child relationships
    void setParentId(const std::string& parentId);
    std::string getParentId() const { return step_.parentId; }
    void addChildId(const std::string& childId);
    void removeChildId(const std::string& childId);
    std::vector<std::string> getChildIds() const { return step_.childIds; }
    
    // Category and priority
    void setCategory(const std::string& category) { step_.category = category; }
    std::string getCategory() const { return step_.category; }
    void setPriority(int priority) { step_.priority = priority; }
    int getPriority() const { return step_.priority; }
    
    // Deadline management
    void setDeadline(const std::chrono::system_clock::time_point& deadline);
    std::chrono::system_clock::time_point getDeadline() const { return step_.deadline; }
    bool isOverdue() const { return step_.isOverdue(); }
    
    // Critical flag
    void setCritical(bool critical) { step_.isCritical = critical; }
    bool isCritical() const { return step_.isCritical; }
    
    // Assignment
    void setAssignedTo(const std::string& assignedTo) { step_.assignedTo = assignedTo; }
    std::string getAssignedTo() const { return step_.assignedTo; }
    
    // Tags
    void addTag(const std::string& tag);
    void removeTag(const std::string& tag);
    bool hasTag(const std::string& tag) const;
    std::vector<std::string> getTags() const { return step_.tags; }
    
    // Data
    void setInputData(const std::string& data) { step_.inputData = data; }
    std::string getInputData() const { return step_.inputData; }
    void setOutputData(const std::string& data) { step_.outputData = data; }
    std::string getOutputData() const { return step_.outputData; }
    
    // Retry management
    bool canRetry() const { return step_.canRetry(); }
    void incrementRetry() { step_.incrementRetry(); }
    void resetRetry() { step_.retryCount = 0; }
    
    // Serialization
    std::string toJson() const;
    static ThinkingStep fromJson(const std::string& json);
    std::string toBinary() const;
    static ThinkingStep fromBinary(const std::string& binary);

private:
    ThinkingStep step_;
    std::mutex mutex_;
};

// ThinkingManager class - manages thinking state and sessions
class ThinkingManager {
public:
    ThinkingManager();
    ~ThinkingManager() = default;

    // Session management
    std::string createSession(const std::string& messageId);
    std::string createSession(const std::string& messageId, const std::string& userId);
    bool hasSession(const std::string& sessionId) const;
    ThinkingSession* getSession(const std::string& sessionId);
    const ThinkingSession* getSession(const std::string& sessionId) const;
    void removeSession(const std::string& sessionId);
    std::vector<std::string> getAllSessionIds() const;
    std::vector<std::string> getSessionIdsByUserId(const std::string& userId) const;
    std::vector<std::string> getSessionIdsByTag(const std::string& tag) const;
    size_t getSessionCount() const;

    // Step management within session
    std::string addStep(const std::string& sessionId, const std::string& label, int order = 0);
    std::string addStep(const std::string& sessionId, const ThinkingStep& step);
    bool updateStepStatus(const std::string& sessionId, const std::string& stepId, StepStatus status);
    bool updateStepStatus(const std::string& sessionId, const std::string& stepId, StepStatus status, const std::string& error);
    bool updateStepProgress(const std::string& sessionId, const std::string& stepId, double progress);
    bool removeStep(const std::string& sessionId, const std::string& stepId);
    std::vector<std::string> getStepIds(const std::string& sessionId) const;
    
    // State management
    void setSessionState(const std::string& sessionId, ThinkingState state);
    ThinkingState getSessionState(const std::string& sessionId) const;
    void pauseSession(const std::string& sessionId);
    void resumeSession(const std::string& sessionId);
    void cancelSession(const std::string& sessionId);
    void retrySession(const std::string& sessionId);
    
    // Progress tracking
    double getSessionProgress(const std::string& sessionId) const;
    int getCompletedSteps(const std::string& sessionId) const;
    int getFailedSteps(const std::string& sessionId) const;
    int getActiveSteps(const std::string& sessionId) const;
    int getTotalSteps(const std::string& sessionId) const;
    double getSuccessRate(const std::string& sessionId) const;
    
    // Session metadata
    void setSessionMetadata(const std::string& sessionId, const std::string& key, const std::string& value);
    std::string getSessionMetadata(const std::string& sessionId, const std::string& key, const std::string& defaultValue = "") const;
    void addSessionTag(const std::string& sessionId, const std::string& tag);
    void removeSessionTag(const std::string& sessionId, const std::string& tag);
    bool sessionHasTag(const std::string& sessionId, const std::string& tag) const;
    
    // Session configuration
    void setSessionModel(const std::string& sessionId, const std::string& model);
    void setSessionTemperature(const std::string& sessionId, double temperature);
    void setSessionMaxTokens(const std::string& sessionId, int maxTokens);
    void setSessionDeadline(const std::string& sessionId, const std::chrono::system_clock::time_point& deadline);
    void setSessionPriority(const std::string& sessionId, int priority);
    void setSessionPersistent(const std::string& sessionId, bool persistent);
    
    // Callbacks
    void setStepCallback(StepCallback callback);
    void setSessionCallback(SessionCallback callback);
    void setProgressCallback(ProgressCallback callback);
    void setErrorCallback(ErrorCallback callback);
    void setCompletionCallback(CompletionCallback callback);
    void setMetricCallback(MetricCallback callback);
    
    // Cleanup
    void cleanupOldSessions(int maxAgeMs);
    void clearAllSessions();
    void clearCompletedSessions();
    void clearFailedSessions();
    
    // Serialization
    std::string sessionToJson(const std::string& sessionId) const;
    std::string allSessionsToJson() const;
    std::string sessionToBinary(const std::string& sessionId) const;
    bool sessionFromBinary(const std::string& binary, ThinkingSession& session) const;
    
    // Statistics
    std::map<std::string, double> getSessionStatistics(const std::string& sessionId) const;
    std::map<std::string, double> getGlobalStatistics() const;
    
    // Search and filtering
    std::vector<ThinkingSession*> searchSessions(const std::string& query) const;
    std::vector<ThinkingSession*> filterSessions(std::function<bool(const ThinkingSession&)> predicate) const;
    std::vector<ThinkingSession*> getSessionsByState(ThinkingState state) const;
    std::vector<ThinkingSession*> getOverdueSessions() const;
    std::vector<ThinkingSession*> getSessionsByPriority(int minPriority) const;

private:
    std::unordered_map<std::string, std::unique_ptr<ThinkingSession>> sessions_;
    std::mutex sessionsMutex_;
    
    StepCallback stepCallback_;
    SessionCallback sessionCallback_;
    ProgressCallback progressCallback_;
    ErrorCallback errorCallback_;
    CompletionCallback completionCallback_;
    MetricCallback metricCallback_;
    std::mutex callbackMutex_;

    void notifyStepChange(const ThinkingStep& step);
    void notifySessionChange(const ThinkingSession& session);
    void notifyProgress(double progress);
    void notifyError(const std::string& sessionId, const std::string& error);
    void notifyCompletion(bool success, const std::string& sessionId);
    void notifyMetric(const std::string& key, double value);
};

// ThinkingService class - backend processing service
class ThinkingService {
public:
    ThinkingService();
    ~ThinkingService();

    // Service lifecycle
    bool start();
    void stop();
    bool isRunning() const { return running_; }
    void restart();

    // Processing
    void processSession(const std::string& sessionId);
    void processStep(const std::string& sessionId, const std::string& stepId);
    void processBatch(const std::vector<std::string>& sessionIds);

    // Async processing with callbacks
    void processSessionAsync(const std::string& sessionId, 
                            std::function<void(bool)> callback = nullptr);
    void processStepAsync(const std::string& sessionId, const std::string& stepId,
                          std::function<void(bool)> callback = nullptr);
    
    // Queue management
    void addToQueue(const std::string& sessionId);
    void addToQueueFront(const std::string& sessionId);
    void removeFromQueue(const std::string& sessionId);
    int getQueueSize() const;
    std::vector<std::string> getQueueContents() const;
    void clearQueue();
    void prioritizeQueue(std::function<bool(const std::string&)> predicate);
    
    // Configuration
    void setMaxConcurrentSessions(int max);
    int getMaxConcurrentSessions() const { return maxConcurrentSessions_; }
    void setProcessingTimeoutMs(int timeout);
    int getProcessingTimeoutMs() const { return processingTimeoutMs_; }
    void setRetryPolicy(int maxRetries, int retryDelayMs);
    void setThreadPoolSize(size_t size);
    
    // Statistics
    int getProcessedCount() const { return processedCount_; }
    int getFailedCount() const { return failedCount_; }
    int getCancelledCount() const { return cancelledCount_; }
    int getTimeoutCount() const { return timeoutCount_; }
    double getAverageProcessingTimeMs() const;
    double getMedianProcessingTimeMs() const;
    double getP95ProcessingTimeMs() const;
    double getP99ProcessingTimeMs() const;
    std::map<std::string, double> getDetailedStatistics() const;
    void resetStatistics();

    // Health check
    bool isHealthy() const;
    std::string getHealthStatus() const;
    std::map<std::string, std::string> getDiagnostics() const;

private:
    std::atomic<bool> running_;
    std::unique_ptr<std::thread> workerThread_;
    std::deque<std::string> processingQueue_;
    std::mutex queueMutex_;
    std::condition_variable queueCondition_;
    
    int maxConcurrentSessions_;
    int processingTimeoutMs_;
    int maxRetries_;
    int retryDelayMs_;
    std::atomic<int> processedCount_;
    std::atomic<int> failedCount_;
    std::atomic<int> cancelledCount_;
    std::atomic<int> timeoutCount_;
    std::vector<double> processingTimes_;
    std::mutex statsMutex_;
    
    ThinkingManager* manager_;
    std::unique_ptr<ThreadPool> threadPool_;

    void workerLoop();
    void processSessionInternal(const std::string& sessionId);
    bool simulateThinkingProcess(const std::string& sessionId);
    bool processStepInternal(const std::string& sessionId, const std::string& stepId);
    void handleTimeout(const std::string& sessionId);
    void handleFailure(const std::string& sessionId, const std::string& error);
    void recordProcessingTime(double durationMs);
};

// ============================================================================
// Utility Functions (Extended)
// ============================================================================

namespace utils {
    // ID generation
    std::string generateId();
    std::string generateUuid();
    std::string generateShortId(size_t length = 8);
    
    // Timestamp
    std::string getCurrentTimestamp();
    std::string getCurrentTimestamp(const std::string& format);
    std::chrono::system_clock::time_point parseTimestamp(const std::string& timestamp);
    
    // Status/State conversions
    std::string statusToString(StepStatus status);
    std::string stateToString(ThinkingState state);
    std::string logLevelToString(LogLevel level);
    std::string cachePolicyToString(CacheEvictionPolicy policy);
    std::string backendToString(PersistenceBackend backend);
    std::string formatToString(SerializationFormat format);
    std::string priorityToString(EventPriority priority);
    
    StepStatus stringToStatus(const std::string& status);
    ThinkingState stringToState(const std::string& state);
    LogLevel stringToLogLevel(const std::string& level);
    CacheEvictionPolicy stringToCachePolicy(const std::string& policy);
    PersistenceBackend stringToBackend(const std::string& backend);
    SerializationFormat stringToFormat(const std::string& format);
    EventPriority stringToPriority(const std::string& priority);
    
    // JSON helpers
    std::string escapeJsonString(const std::string& str);
    std::string unescapeJsonString(const std::string& str);
    std::string buildJsonPair(const std::string& key, const std::string& value);
    std::string buildJsonPair(const std::string& key, int value);
    std::string buildJsonPair(const std::string& key, double value);
    std::string buildJsonPair(const std::string& key, bool value);
    
    // String utilities
    std::string toLower(const std::string& str);
    std::string toUpper(const std::string& str);
    std::string trim(const std::string& str);
    std::string trimLeft(const std::string& str);
    std::string trimRight(const std::string& str);
    std::vector<std::string> split(const std::string& str, char delimiter);
    std::string join(const std::vector<std::string>& parts, const std::string& delimiter);
    std::string replace(const std::string& str, const std::string& from, const std::string& to);
    bool startsWith(const std::string& str, const std::string& prefix);
    bool endsWith(const std::string& str, const std::string& suffix);
    bool contains(const std::string& str, const std::string& substr);
    
    // Number utilities
    bool isNumeric(const std::string& str);
    double toDouble(const std::string& str);
    int toInt(const std::string& str);
    long toLong(const std::string& str);
    std::string toString(int value);
    std::string toString(double value);
    std::string toString(bool value);
    
    // Time utilities
    std::string formatDuration(double durationMs);
    std::string formatDurationPrecise(double durationMs);
    double parseDuration(const std::string& duration);
    
    // Hash utilities
    size_t hashString(const std::string& str);
    std::string md5Hash(const std::string& str);
    std::string sha256Hash(const std::string& str);
    
    // Base64 encoding/decoding
    std::string base64Encode(const std::string& str);
    std::string base64Encode(const std::vector<uint8_t>& data);
    std::string base64Decode(const std::string& encoded);
    std::vector<uint8_t> base64DecodeToBytes(const std::string& encoded);
    
    // Hex encoding/decoding
    std::string hexEncode(const std::string& str);
    std::string hexEncode(const std::vector<uint8_t>& data);
    std::string hexDecode(const std::string& encoded);
    std::vector<uint8_t> hexDecodeToBytes(const std::string& encoded);
    
    // URL encoding/decoding
    std::string urlEncode(const std::string& str);
    std::string urlDecode(const std::string& str);
    
    // File path utilities
    std::string joinPath(const std::string& base, const std::string& relative);
    std::string getFileName(const std::string& path);
    std::string getFileExtension(const std::string& path);
    std::string getDirectory(const std::string& path);
    bool fileExists(const std::string& path);
    bool directoryExists(const std::string& path);
    size_t fileSize(const std::string& path);
    bool createDirectory(const std::string& path);
    bool deleteFile(const std::string& path);
    bool deleteDirectory(const std::string& path);
    
    // Random utilities
    int randomInt(int min, int max);
    double randomDouble(double min, double max);
    std::string randomString(size_t length);
    std::string randomAlphaNumeric(size_t length);
    std::string randomBytes(size_t length);
    
    // Compression utilities
    std::string compress(const std::string& data);
    std::string decompress(const std::string& compressed);
    std::vector<uint8_t> compressBytes(const std::vector<uint8_t>& data);
    std::vector<uint8_t> decompressBytes(const std::vector<uint8_t>& compressed);
    
    // Version utilities
    bool versionCompare(const std::string& v1, const std::string& v2);
    int versionMajor(const std::string& version);
    int versionMinor(const std::string& version);
    int versionPatch(const std::string& version);
}

} // namespace thinking
} // namespace nexus

#endif // THINKING_H
