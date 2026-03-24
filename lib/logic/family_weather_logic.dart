import '../models/chore.dart';
import '../models/weather_state.dart';

class FamilyWeatherLogic {
  const FamilyWeatherLogic();

  int calculateScore(List<Chore> chores) {
    final pendingWeight = chores
        .where((chore) => chore.isPending)
        .fold<int>(0, (sum, chore) => sum + chore.weight);

    final positiveBuffer = chores.where((chore) => !chore.isPending).fold<int>(
      0,
      (sum, chore) => sum + _completionBonus(chore),
    );

    final score = 100 - pendingWeight + positiveBuffer;
    return score.clamp(0, 100);
  }

  int _completionBonus(Chore chore) {
    var bonus = 1;

    if (chore.isCompletedEarly) {
      bonus += chore.weight;
    }

    return bonus;
  }

  WeatherState toWeatherState(List<Chore> chores) {
    final score = calculateScore(chores);

    if (score > 80) {
      return WeatherState.sunny;
    }
    if (score >= 50) {
      return WeatherState.cloudy;
    }
    return WeatherState.rainy;
  }

  int pendingWeight(List<Chore> chores) {
    return chores
        .where((chore) => chore.isPending)
        .fold<int>(0, (sum, chore) => sum + chore.weight);
  }

  int completedCount(List<Chore> chores) {
    return chores.where((chore) => !chore.isPending).length;
  }

  String weatherNarrative({
    required List<Chore> chores,
    required int previousScore,
  }) {
    final score = calculateScore(chores);
    final trend = score - previousScore;

    if (trend >= 6) {
      return '天氣正在放晴中，保持目前節奏就能迎來晴天。';
    }
    if (trend <= -6) {
      return '雲層正在變厚，先完成一件輕量任務來止跌。';
    }

    final state = toWeatherState(chores);
    switch (state) {
      case WeatherState.sunny:
        return '家裡氣氛穩定晴朗，適合維持日常小清潔。';
      case WeatherState.cloudy:
        return '目前是多雲狀態，再完成一件就會明顯轉晴。';
      case WeatherState.rainy:
        return '目前偏陰雨，使用換手求援可以快速減壓。';
    }
  }
}
